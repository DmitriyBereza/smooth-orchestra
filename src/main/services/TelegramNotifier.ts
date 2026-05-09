import { eventBus } from './EventBus';
import { TelegramService } from './TelegramService';
import { SessionState } from '../types';

export class TelegramNotifier {
  private sessionCache = new Map<string, { taskId: string; title: string }>();

  constructor(
    private telegram: TelegramService,
    private getSession: () => SessionState | null,
  ) {
    this.setup();
  }

  private setup(): void {
    eventBus.on('session:created', (session: SessionState) => {
      this.sessionCache.set(session.id, {
        taskId: session.task.id,
        title: session.task.title,
      });
    });

    eventBus.on('session:stage-changed', async ({ sessionId, to }) => {
      if (!this.telegram.isConfigured()) return;

      const session = this.getSession();
      if (session?.id !== sessionId) return;

      if (to === 'awaiting_user_review' && !session.autoApproveSpec) {
        const info = this.resolveInfo(sessionId);
        if (!info) return;
        try {
          await this.telegram.sendMessage(
            `📋 *PO Gate Ready*\n\nTask *${info.title}* (${info.taskId}) — the spec is ready for your review.\nApprove or reject the proposed pipeline.`,
          );
        } catch (err) {
          console.error('[TelegramNotifier] Failed to send PO gate notification:', err);
        }
      }

      if (to === 'awaiting_merge_approval' && !session.autoSkipMerge) {
        const info = this.resolveInfo(sessionId);
        if (!info) return;
        try {
          await this.telegram.sendMessage(
            `✅ *QA Passed — Ready to Merge*\n\nTask *${info.title}* (${info.taskId}) — QA approved. Approve the merge or send back for changes.`,
          );
        } catch (err) {
          console.error('[TelegramNotifier] Failed to send merge-ready notification:', err);
        }
      }
    });

    eventBus.on('session:completed', ({ sessionId }) => {
      this.sessionCache.delete(sessionId);
    });

    eventBus.on('session:failed', ({ sessionId }) => {
      this.sessionCache.delete(sessionId);
    });
  }

  private resolveInfo(sessionId: string): { taskId: string; title: string } | null {
    if (this.sessionCache.has(sessionId)) return this.sessionCache.get(sessionId)!;
    const session = this.getSession();
    if (session?.id === sessionId) {
      const info = { taskId: session.task.id, title: session.task.title };
      this.sessionCache.set(sessionId, info);
      return info;
    }
    return null;
  }
}
