import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import {
  StandbyRole,
  StandbyState,
  BacklogItem,
  STANDBY_ROLES,
} from '../types/standby';
import { ProjectRecord } from '../types/project';
import { eventBus } from './EventBus';
import { SessionManager } from './SessionManager';
import { ProjectStore } from './ProjectStore';
import { getStandbyPrompt } from '../prompts/standby';
import { buildManualQaContext } from './PromptContextBuilder';

/**
 * Owns the idle-time improvement loop.
 *
 * Responsibilities:
 *   - Persistent ON/OFF toggle (default OFF — never burns API limits without consent).
 *   - 1-minute idle timer; each tick spawns one standby agent with a (role, project) pair.
 *   - Round-robin across (1) the three standby roles AND (2) the registered projects whose
 *     `standby.enabled === true`. Both indexes advance every tick — over a few ticks every
 *     enabled project sees every role in turn.
 *   - Cross-rotation memory under .orchestra/standby/_memory/{role}__{projectId}.md so each
 *     (role, project) pair tracks its own history.
 *   - Backlog of proposals at .orchestra/standby/backlog.json (each item carries projectId
 *     so the UI can pre-select the source project on promote).
 *   - Auto-execute governor: small tech-debt items can be promoted to a real dev pipeline
 *     within a rate cap, scoped to the originating project.
 *
 * Standby agents are spawned as standalone `claude` CLI processes (not via AgentPool) — they
 * are orthogonal to the task pipeline.
 */
export class StandbyScheduler {
  private state: StandbyState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentProcess: ChildProcess | null = null;
  private currentRole: StandbyRole | null = null;
  private statePath: string;
  private backlogPath: string;
  private standbyDir: string;
  private memoryDir: string;

  private static readonly TICK_INTERVAL_MS = 60_000;
  private static readonly AUTO_EXECUTE_PER_HOUR = 1;
  private static readonly AUTO_EXECUTE_PER_DAY = 3;
  private static readonly MAX_BACKLOG_ITEMS = 100;

  constructor(
    private orchestraDir: string,
    private orchestraProjectPath: string,
    private sessionManager: SessionManager,
    private projectStore: ProjectStore | undefined,
  ) {
    this.standbyDir = path.join(orchestraDir, 'standby');
    this.memoryDir = path.join(this.standbyDir, '_memory');
    this.statePath = path.join(this.standbyDir, 'state.json');
    this.backlogPath = path.join(this.standbyDir, 'backlog.json');
    this.ensureDirs();
    this.state = this.loadState();
    this.ensureBacklogFile();
    this.attachLifecycleListeners();

    if (this.state.enabled) {
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  getState(): StandbyState {
    return { ...this.state };
  }

  setEnabled(enabled: boolean): StandbyState {
    if (this.state.enabled === enabled) return this.getState();
    this.state.enabled = enabled;
    this.persistState();

    if (enabled) {
      console.log('[StandbyScheduler] enabled — first tick in 60s');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
    } else {
      console.log('[StandbyScheduler] disabled — cancelling pending tick');
      this.cancelTick();
      this.killCurrentProcess();
    }

    eventBus.emit('standby:state-changed', { state: this.getState() });
    return this.getState();
  }

  getBacklog(): BacklogItem[] {
    return this.loadBacklog();
  }

  /**
   * Promote a backlog item to a real task using the chosen pipeline type.
   * Returns the new task ID (created via SessionManager.createTask).
   */
  async promoteItem(
    itemId: string,
    pipelineType: 'development' | 'marketing' | 'design',
    projectIds: string[],
  ): Promise<string> {
    const backlog = this.loadBacklog();
    const item = backlog.find((b) => b.id === itemId);
    if (!item) throw new Error(`Backlog item not found: ${itemId}`);
    if (item.status !== 'draft') {
      throw new Error(`Backlog item ${itemId} is not in draft state (current: ${item.status})`);
    }

    const session = await this.sessionManager.createTask(
      item.title,
      item.body,
      projectIds,
      undefined,
      undefined,
      undefined,
      pipelineType,
    );

    item.status = 'promoted';
    item.promotedTaskId = session.task.id;
    this.saveBacklog(backlog);
    this.appendToMemory(
      item.source,
      item.projectId ?? null,
      `promoted: ${item.id} ${item.title} → ${session.task.id}`,
    );

    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    return session.task.id;
  }

  dismissItem(itemId: string, reason?: string): BacklogItem[] {
    const backlog = this.loadBacklog();
    const item = backlog.find((b) => b.id === itemId);
    if (!item) throw new Error(`Backlog item not found: ${itemId}`);
    item.status = 'dismissed';
    if (reason) item.note = reason;
    this.saveBacklog(backlog);
    this.appendToMemory(
      item.source,
      item.projectId ?? null,
      `dismissed: ${item.id} ${item.title}${reason ? ` — ${reason}` : ''}`,
    );
    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    return this.loadBacklog();
  }

  // ─── Tick scheduling ──────────────────────────────────────────────────────

  private attachLifecycleListeners(): void {
    eventBus.on('session:created', () => this.cancelTick());
    eventBus.on('session:stage-changed', ({ to }) => {
      const idleAfter: string[] = ['done', 'failed', 'idle'];
      if (idleAfter.includes(to as string) && this.state.enabled) {
        this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      }
    });
  }

  private scheduleNextTick(delayMs: number): void {
    this.cancelTick();
    if (!this.state.enabled) return;
    this.state.nextTickAt = new Date(Date.now() + delayMs).toISOString();
    this.persistState();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runTick().catch((err) => {
        console.error('[StandbyScheduler] tick failed:', err);
        this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      });
    }, delayMs);
  }

  private cancelTick(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.nextTickAt = null;
    this.persistState();
  }

  private isIdle(): boolean {
    const session = this.sessionManager.getSession();
    if (!session) return true;
    const terminal = ['done', 'failed', 'idle'];
    return terminal.includes(session.currentStage as string);
  }

  /**
   * Return the registered projects whose `standby.enabled === true`.
   * Order is stable (same as ProjectStore order) so the rotation index is meaningful.
   */
  private getStandbyTargets(): ProjectRecord[] {
    if (!this.projectStore) return [];
    return this.projectStore.all().filter((p) => p.standby?.enabled === true);
  }

  private async runTick(): Promise<void> {
    if (!this.state.enabled) return;

    if (!this.isIdle()) {
      console.log('[StandbyScheduler] not idle — skipping tick, retrying in 60s');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    if (this.currentProcess) {
      console.log('[StandbyScheduler] previous standby agent still running — skipping tick');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    const targets = this.getStandbyTargets();
    if (targets.length === 0) {
      console.log('[StandbyScheduler] no projects opted in (standby.enabled=true) — skipping tick');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    const role = STANDBY_ROLES[this.state.rotationIndex % STANDBY_ROLES.length];
    const project = targets[this.state.projectRotationIndex % targets.length];

    // Advance both rotations so over a few ticks every (role, project) combo gets coverage.
    this.state.rotationIndex = (this.state.rotationIndex + 1) % STANDBY_ROLES.length;
    this.state.projectRotationIndex = (this.state.projectRotationIndex + 1) % targets.length;
    this.state.lastTickAt = new Date().toISOString();
    this.persistState();

    eventBus.emit('standby:tick-started', { role, startedAt: this.state.lastTickAt });

    try {
      await this.spawnStandbyAgent(role, project);
    } catch (err) {
      console.error(`[StandbyScheduler] failed to spawn ${role} for ${project.name}:`, err);
    } finally {
      if (this.state.enabled) {
        this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      }
    }
  }

  // ─── Agent spawning ───────────────────────────────────────────────────────

  private async spawnStandbyAgent(role: StandbyRole, project: ProjectRecord): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const dayDir = path.join(this.standbyDir, today);
    if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeProjectSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || project.id.slice(0, 8);
    const outputPath = path.join(dayDir, `${role}__${safeProjectSlug}-${ts}.md`);
    const memoryPath = this.memoryPathFor(role, project.id);
    if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, '', 'utf-8');

    const lastTaskId = this.findLastCompletedTaskIdForProject(project.id) ?? '';
    const manualQaContext = buildManualQaContext(project.manualQa, {
      branch: 'main',
      taskId: lastTaskId,
    });

    const promptTemplate = getStandbyPrompt(role);
    const systemPrompt = promptTemplate
      .replaceAll('{PROJECT_PATH}', project.path)
      .replaceAll('{PROJECT_ID}', project.id)
      .replaceAll('{PROJECT_NAME}', project.name)
      .replaceAll('{MEMORY_PATH}', memoryPath)
      .replaceAll('{OUTPUT_PATH}', outputPath)
      .replaceAll('{BACKLOG_PATH}', this.backlogPath)
      .replaceAll('{LAST_TASK_ID}', lastTaskId)
      .replaceAll('{MANUAL_QA_CONTEXT}', manualQaContext);

    const taskPrompt = [
      `Standby tick — role: ${role}.`,
      `Target project: ${project.name} (${project.id}) at ${project.path}.`,
      `Today: ${today}.`,
      `Set the \`projectId\` field of every BacklogItem you append to "${project.id}" and \`projectName\` to "${project.name}".`,
      `Begin your scan now.`,
    ].join('\n');

    const args = [
      '-p', taskPrompt,
      '--system-prompt', systemPrompt,
      '--output-format', 'stream-json',
      '--max-turns', '60',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    return new Promise<void>((resolve, reject) => {
      const child = spawn('claude', args, {
        cwd: project.path,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      this.currentProcess = child;
      this.currentRole = role;

      child.stdout?.on('data', () => { /* drain */ });
      child.stderr?.on('data', (chunk) => {
        process.stderr.write(`[StandbyScheduler:${role}:${project.name}] ${chunk}`);
      });

      child.on('exit', (code) => {
        this.currentProcess = null;
        this.currentRole = null;
        if (code === 0) {
          console.log(`[StandbyScheduler] ${role}/${project.name} finished — output: ${outputPath}`);
          this.afterAgentExit(role, project).catch((err) =>
            console.error(`[StandbyScheduler] post-tick processing failed:`, err),
          );
          resolve();
        } else {
          console.warn(`[StandbyScheduler] ${role}/${project.name} exited with code ${code}`);
          resolve();
        }
        eventBus.emit('standby:tick-finished', { role, exitCode: code ?? 0 });
      });
      child.on('error', (err) => {
        this.currentProcess = null;
        this.currentRole = null;
        reject(err);
      });
    });
  }

  private killCurrentProcess(): void {
    if (this.currentProcess) {
      console.log(`[StandbyScheduler] killing in-flight ${this.currentRole} agent`);
      try {
        this.currentProcess.kill('SIGTERM');
      } catch { /* swallow */ }
      this.currentProcess = null;
      this.currentRole = null;
    }
  }

  /**
   * After a standby agent exits, scan the backlog for new draft items from the
   * tech-debt scout that meet the auto-execute criteria. Promote them (subject
   * to the rate cap) to a real dev pipeline targeted at the project the item
   * came from.
   */
  private async afterAgentExit(role: StandbyRole, project: ProjectRecord): Promise<void> {
    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });

    if (role !== 'tech-debt-scout') return;

    const candidates = this.loadBacklog().filter(
      (item) =>
        item.source === 'tech-debt-scout' &&
        item.status === 'draft' &&
        item.complexity === 'small' &&
        (item.estimatedFiles ?? Infinity) <= 3 &&
        // Only auto-execute for the project we just scanned (avoid cross-project surprises)
        (item.projectId === project.id || !item.projectId),
    );

    if (candidates.length === 0) return;

    if (!this.canAutoExecute()) {
      console.log('[StandbyScheduler] auto-execute rate cap hit — leaving items as drafts');
      return;
    }

    const target = candidates[0];

    try {
      const session = await this.sessionManager.createTask(
        `[auto] ${target.title}`,
        target.body,
        [project.id],
        undefined,
        undefined,
        undefined,
        'development',
      );
      target.status = 'auto-executed';
      target.promotedTaskId = session.task.id;
      target.note = 'Auto-executed by standby governor (small + ≤3 files + no public API impact)';
      target.projectId = project.id;
      target.projectName = project.name;
      this.saveBacklog(this.loadBacklog().map((i) => (i.id === target.id ? target : i)));
      this.recordAutoExecute();
      this.appendToMemory(role, project.id, `auto-executed: ${target.id} ${target.title} → ${session.task.id}`);
      console.log(`[StandbyScheduler] auto-executed ${target.id} → ${session.task.id} (project: ${project.name})`);
      eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    } catch (err) {
      console.error('[StandbyScheduler] auto-execute failed:', err);
    }
  }

  private canAutoExecute(): boolean {
    const now = Date.now();
    const oneHour = 60 * 60_000;
    const oneDay = 24 * 60 * 60_000;
    const recent = this.state.autoExecutes
      .map((iso) => new Date(iso).getTime())
      .filter((t) => !Number.isNaN(t));

    const inLastHour = recent.filter((t) => now - t < oneHour).length;
    const inLastDay = recent.filter((t) => now - t < oneDay).length;

    return (
      inLastHour < StandbyScheduler.AUTO_EXECUTE_PER_HOUR &&
      inLastDay < StandbyScheduler.AUTO_EXECUTE_PER_DAY
    );
  }

  private recordAutoExecute(): void {
    this.state.autoExecutes.push(new Date().toISOString());
    const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
    this.state.autoExecutes = this.state.autoExecutes.filter(
      (iso) => new Date(iso).getTime() > weekAgo,
    );
    this.persistState();
  }

  // ─── Memory helpers ───────────────────────────────────────────────────────

  private memoryPathFor(role: StandbyRole, projectId: string | null): string {
    const safe = (projectId ?? 'global').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.memoryDir, `${role}__${safe}.md`);
  }

  private appendToMemory(
    role: StandbyRole,
    projectId: string | null,
    line: string,
  ): void {
    const memoryPath = this.memoryPathFor(role, projectId);
    const stamp = new Date().toISOString();
    const entry = `- ${stamp} ${line}\n`;
    try {
      fs.appendFileSync(memoryPath, entry, 'utf-8');
      const raw = fs.readFileSync(memoryPath, 'utf-8');
      if (raw.length > 2000) {
        const lines = raw.split('\n');
        const kept = lines.slice(Math.max(0, lines.length - 50));
        fs.writeFileSync(memoryPath, kept.join('\n'), 'utf-8');
      }
    } catch (err) {
      console.error(`[StandbyScheduler] failed to update memory for ${role}/${projectId}:`, err);
    }
  }

  // ─── Persistence helpers ──────────────────────────────────────────────────

  private ensureDirs(): void {
    for (const dir of [this.standbyDir, this.memoryDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  private ensureBacklogFile(): void {
    if (!fs.existsSync(this.backlogPath)) {
      fs.writeFileSync(this.backlogPath, '[]', 'utf-8');
    }
  }

  private loadState(): StandbyState {
    const defaultState: StandbyState = {
      enabled: false,
      rotationIndex: 0,
      projectRotationIndex: 0,
      lastTickAt: null,
      nextTickAt: null,
      autoExecutes: [],
    };
    try {
      if (!fs.existsSync(this.statePath)) return defaultState;
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StandbyState>;
      return {
        enabled: parsed.enabled ?? false,
        rotationIndex: parsed.rotationIndex ?? 0,
        projectRotationIndex: parsed.projectRotationIndex ?? 0,
        lastTickAt: parsed.lastTickAt ?? null,
        nextTickAt: parsed.nextTickAt ?? null,
        autoExecutes: Array.isArray(parsed.autoExecutes) ? parsed.autoExecutes : [],
      };
    } catch (err) {
      console.error('[StandbyScheduler] failed to load state, using defaults:', err);
      return defaultState;
    }
  }

  private persistState(): void {
    try {
      const tmp = `${this.statePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmp, this.statePath);
    } catch (err) {
      console.error('[StandbyScheduler] failed to persist state:', err);
    }
  }

  private loadBacklog(): BacklogItem[] {
    try {
      const raw = fs.readFileSync(this.backlogPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as BacklogItem[];
    } catch {
      return [];
    }
  }

  private saveBacklog(items: BacklogItem[]): void {
    let capped = items;
    if (items.length > StandbyScheduler.MAX_BACKLOG_ITEMS) {
      const sorted = [...items].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      capped = sorted.slice(0, StandbyScheduler.MAX_BACKLOG_ITEMS);
    }
    try {
      const tmp = `${this.backlogPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(capped, null, 2), 'utf-8');
      fs.renameSync(tmp, this.backlogPath);
    } catch (err) {
      console.error('[StandbyScheduler] failed to save backlog:', err);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /**
   * Return the most recent completed task ID for a given project (so the
   * regression-qa role can re-validate it), or null if none.
   */
  private findLastCompletedTaskIdForProject(projectId: string): string | null {
    try {
      const history = this.sessionManager.getSessionHistory();
      const done = history.find(
        (s) => s.currentStage === 'done' && s.projectId === projectId,
      );
      return done?.task.id ?? null;
    } catch {
      return null;
    }
  }

  static newId(): string {
    return uuid();
  }
}
