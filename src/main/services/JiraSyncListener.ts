import { eventBus } from './EventBus';
import { JiraService } from './JiraService';
import { SessionState } from '../types';

// Stage transitions that warrant a Jira comment (skip noisy early stages)
const STAGE_COMMENTS: Record<string, string> = {
  developer: '👨‍💻 Developer agent started implementation',
  'tl-code-review': '👀 Tech Lead reviewing code',
  qa: '🧪 QA agent started testing',
  awaiting_merge_approval: '✅ QA approved — awaiting merge approval',
};

/**
 * Subscribes to Orchestra pipeline events and mirrors status + comments to Jira.
 * Only acts when a session has a linked jiraIssueKey.
 */
export class JiraSyncListener {
  // sessionId → jiraIssueKey cache (avoids re-reading session for every event)
  private sessionKeys = new Map<string, string>();

  constructor(
    private jira: JiraService,
    private getSession: () => SessionState | null,
  ) {
    this.setup();
  }

  private setup(): void {
    // ── session:created ──────────────────────────────────────────────────────
    // Payload is the full SessionState (emitted by SessionManager.createTask)
    eventBus.on('session:created', async (session: SessionState) => {
      if (!this.jira.isConfigured() || !session.jiraIssueKey) return;
      this.sessionKeys.set(session.id, session.jiraIssueKey);

      try {
        await this.jira.startProgress(session.jiraIssueKey);
        await this.jira.addComment(
          session.jiraIssueKey,
          `Smooth Orchestra pipeline started for *${session.task.title}* (${session.task.id}).`,
        );
        console.log(`[JiraSyncListener] Marked ${session.jiraIssueKey} In Progress`);
      } catch (err) {
        console.error('[JiraSyncListener] session:created handler failed:', err);
      }
    });

    // ── session:stage-changed ────────────────────────────────────────────────
    eventBus.on(
      'session:stage-changed',
      async ({ sessionId, to }: { sessionId: string; from: string; to: string }) => {
        if (!this.jira.isConfigured()) return;
        const key = this.resolveKey(sessionId);
        if (!key) return;

        const comment = STAGE_COMMENTS[to];
        if (!comment) return;

        try {
          await this.jira.addComment(key, comment);
        } catch (err) {
          console.error(`[JiraSyncListener] stage-changed comment failed (${key}):`, err);
        }
      },
    );

    // ── session:completed ────────────────────────────────────────────────────
    eventBus.on(
      'session:completed',
      async ({ sessionId, taskId }: { sessionId: string; taskId: string }) => {
        if (!this.jira.isConfigured()) return;
        const key = this.resolveKey(sessionId);
        if (!key) return;

        try {
          await this.jira.markDone(key);
          await this.jira.addComment(
            key,
            `Smooth Orchestra pipeline completed for task *${taskId}*. Implementation approved and ready to merge.`,
          );
          console.log(`[JiraSyncListener] Marked ${key} Done`);
          this.sessionKeys.delete(sessionId);
        } catch (err) {
          console.error(`[JiraSyncListener] session:completed handler failed (${key}):`, err);
        }
      },
    );

    // ── session:failed ───────────────────────────────────────────────────────
    eventBus.on(
      'session:failed',
      async ({ sessionId, taskId, error }: { sessionId: string; taskId: string; error: string }) => {
        if (!this.jira.isConfigured()) return;
        const key = this.resolveKey(sessionId);
        if (!key) return;

        try {
          await this.jira.addComment(
            key,
            `Smooth Orchestra pipeline failed for task *${taskId}*: ${error}`,
          );
          this.sessionKeys.delete(sessionId);
        } catch (err) {
          console.error(`[JiraSyncListener] session:failed handler failed (${key}):`, err);
        }
      },
    );
  }

  private resolveKey(sessionId: string): string | null {
    // Try cache first, then fall back to live session lookup
    if (this.sessionKeys.has(sessionId)) return this.sessionKeys.get(sessionId)!;
    const session = this.getSession();
    if (session?.id === sessionId && session.jiraIssueKey) {
      this.sessionKeys.set(sessionId, session.jiraIssueKey);
      return session.jiraIssueKey;
    }
    return null;
  }
}
