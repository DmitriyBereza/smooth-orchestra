import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { eventBus } from './EventBus';
import { ProjectStore } from './ProjectStore';
import { ChatAgentProcess } from './ChatAgentProcess';
import { buildPoChatSystemPrompt } from '../prompts/po-chat';
import { PoChatMessage } from '../types/po-chat';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Manages PO chat agent lifecycles, history persistence, and cleanup.
 *
 * - One agent per project at a time (busy flag)
 * - History persisted to {orchestraDir}/po-chat/{projectId}/history.json
 * - Messages older than 3 days are pruned on startup and hourly
 */
export class PoChatService {
  /** Active chat agents keyed by projectId */
  private agents: Map<string, ChatAgentProcess> = new Map();
  /** Last Claude session ID per project (for --resume) */
  private sessionIds: Map<string, string> = new Map();
  /** Busy flag per project */
  private busy: Map<string, boolean> = new Map();
  /** Interval handle for periodic pruning */
  private pruneInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly projectStore: ProjectStore,
    private readonly orchestraDir: string,
  ) {
    // Prune on startup and then hourly
    this.pruneHistory().catch((err) => {
      console.warn('[PoChatService] Initial prune failed:', err);
    });
    this.pruneInterval = setInterval(() => {
      this.pruneHistory().catch((err) => {
        console.warn('[PoChatService] Periodic prune failed:', err);
      });
    }, PRUNE_INTERVAL_MS);
  }

  /**
   * Handle an incoming chat message from the user.
   *
   * Validates the project, checks busy state, persists the user message,
   * spawns or resumes a ChatAgentProcess, streams chunks via EventBus,
   * and appends the assistant reply to history on completion.
   */
  async handleMessage(projectId: string, message: string): Promise<void> {
    // Validate project exists
    const project = this.projectStore.findById(projectId);
    if (!project) {
      eventBus.emit('po-chat:error', {
        projectId,
        error: `Project not found: ${projectId}`,
      });
      return;
    }

    // Validate project path is accessible
    if (!fs.existsSync(project.path)) {
      eventBus.emit('po-chat:error', {
        projectId,
        error: `Project path is inaccessible: ${project.path}`,
      });
      return;
    }

    // Check busy state
    if (this.busy.get(projectId)) {
      eventBus.emit('po-chat:busy', { projectId });
      return;
    }

    this.busy.set(projectId, true);
    const messageId = uuid();

    // Persist user message
    await this.appendMessage(projectId, {
      id: uuid(),
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Accumulate assistant response for history persistence
    let assistantContent = '';

    const onChunk = (content: string, done: boolean) => {
      if (content) {
        assistantContent += content;
        eventBus.emit('po-chat:response', { projectId, content, messageId, done: false });
      }

      if (done) {
        // Persist assistant message
        if (assistantContent) {
          this.appendMessage(projectId, {
            id: uuid(),
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date().toISOString(),
          }).catch((err) => {
            console.warn('[PoChatService] Failed to persist assistant message:', err);
          });
        }

        // Store session ID for next --resume
        const agent = this.agents.get(projectId);
        if (agent?.lastSessionId) {
          this.sessionIds.set(projectId, agent.lastSessionId);
        }

        this.busy.set(projectId, false);
        eventBus.emit('po-chat:response', { projectId, content: '', messageId, done: true });
      }
    };

    const onError = (error: string) => {
      console.error('[PoChatService] Agent error:', error);
      // Reset session on error so next message starts fresh
      this.sessionIds.delete(projectId);
      this.busy.set(projectId, false);
      eventBus.emit('po-chat:error', { projectId, error });
    };

    try {
      const existingSessionId = this.sessionIds.get(projectId);

      if (existingSessionId) {
        // Resume existing session
        let agent = this.agents.get(projectId);
        if (!agent) {
          agent = new ChatAgentProcess(project.path);
          this.agents.set(projectId, agent);
        }
        await agent.resume(existingSessionId, message, onChunk, onError);
      } else {
        // Spawn new agent
        const agent = new ChatAgentProcess(project.path);
        this.agents.set(projectId, agent);
        await agent.start(message, buildPoChatSystemPrompt(), onChunk, onError);
      }
    } catch (err: any) {
      this.busy.set(projectId, false);
      eventBus.emit('po-chat:error', {
        projectId,
        error: err.message ?? 'Unknown error starting chat agent',
      });
    }
  }

  /**
   * Returns the persisted chat history for a project.
   */
  async getHistory(projectId: string): Promise<PoChatMessage[]> {
    const historyPath = this.historyFilePath(projectId);
    if (!fs.existsSync(historyPath)) {
      return [];
    }
    try {
      const raw = await fs.promises.readFile(historyPath, 'utf-8');
      return JSON.parse(raw) as PoChatMessage[];
    } catch {
      return [];
    }
  }

  /**
   * Clears chat history and kills any active agent for the project.
   */
  async clearChat(projectId: string): Promise<void> {
    // Kill active agent if any
    const agent = this.agents.get(projectId);
    if (agent) {
      agent.kill();
      this.agents.delete(projectId);
    }

    // Clear state
    this.sessionIds.delete(projectId);
    this.busy.set(projectId, false);

    // Delete history file
    const historyPath = this.historyFilePath(projectId);
    if (fs.existsSync(historyPath)) {
      await fs.promises.unlink(historyPath);
    }

    eventBus.emit('po-chat:cleared', { projectId });
  }

  /**
   * Clear the periodic prune timer (call on server shutdown).
   */
  dispose(): void {
    if (this.pruneInterval !== null) {
      clearInterval(this.pruneInterval);
      this.pruneInterval = null;
    }
    // Kill all active agents
    for (const agent of this.agents.values()) {
      agent.kill();
    }
    this.agents.clear();
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Prune messages older than 3 days from all history files.
   */
  private async pruneHistory(): Promise<void> {
    const poChatDir = path.join(this.orchestraDir, 'po-chat');
    if (!fs.existsSync(poChatDir)) return;

    let projectDirs: string[];
    try {
      projectDirs = fs.readdirSync(poChatDir);
    } catch {
      return;
    }

    const cutoff = Date.now() - THREE_DAYS_MS;

    for (const projectId of projectDirs) {
      const historyPath = path.join(poChatDir, projectId, 'history.json');
      if (!fs.existsSync(historyPath)) continue;

      try {
        const raw = await fs.promises.readFile(historyPath, 'utf-8');
        const messages: PoChatMessage[] = JSON.parse(raw);
        const fresh = messages.filter((m) => Date.parse(m.timestamp) > cutoff);

        if (fresh.length === 0) {
          await fs.promises.unlink(historyPath);
        } else if (fresh.length < messages.length) {
          await this.writeHistoryFile(historyPath, fresh);
        }
      } catch (err) {
        console.warn(`[PoChatService] Failed to prune history for ${projectId}:`, err);
      }
    }
  }

  /** Append a single message to the project's history file. */
  private async appendMessage(projectId: string, message: PoChatMessage): Promise<void> {
    const historyPath = this.historyFilePath(projectId);
    const dir = path.dirname(historyPath);

    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    let messages: PoChatMessage[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        const raw = await fs.promises.readFile(historyPath, 'utf-8');
        messages = JSON.parse(raw);
      } catch {
        messages = [];
      }
    }

    messages.push(message);
    await this.writeHistoryFile(historyPath, messages);
  }

  /** Atomic write to history file (write .tmp then rename). */
  private async writeHistoryFile(historyPath: string, messages: PoChatMessage[]): Promise<void> {
    const tmpPath = `${historyPath}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, historyPath);
  }

  private historyFilePath(projectId: string): string {
    return path.join(this.orchestraDir, 'po-chat', projectId, 'history.json');
  }
}
