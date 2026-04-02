import React from 'react';
import { SessionState, STAGE_DISPLAY, PipelineStage } from '../../store/sessionStore';

interface TaskCardProps {
  session: SessionState;
  onApprove?: () => void;
  onReject?: (feedback: string) => void;
  onAbort?: () => void;
}

function getStageColor(stage: PipelineStage): string {
  switch (stage) {
    case 'done': return 'var(--accent-green)';
    case 'failed': return 'var(--accent-red)';
    case 'rejected': return 'var(--accent-red)';
    case 'awaiting_user_review': return 'var(--accent-yellow)';
    default: return 'var(--accent-blue)';
  }
}

export const TaskCard: React.FC<TaskCardProps> = ({ session, onApprove, onReject, onAbort }) => {
  const [feedback, setFeedback] = React.useState('');
  const [showReject, setShowReject] = React.useState(false);

  const isAwaitingReview = session.currentStage === 'awaiting_user_review';
  const isActive = !['done', 'failed', 'idle'].includes(session.currentStage);
  const elapsed = getElapsed(session.startedAt);

  return (
    <div
      style={{
        ...styles.card,
        borderLeftColor: getStageColor(session.currentStage),
      }}
      className={isAwaitingReview ? 'needs-attention' : ''}
    >
      <div style={styles.header}>
        <span style={styles.taskId}>{session.task.id}</span>
        <span
          style={{
            ...styles.badge,
            backgroundColor: `${getStageColor(session.currentStage)}22`,
            color: getStageColor(session.currentStage),
          }}
        >
          {STAGE_DISPLAY[session.currentStage]}
        </span>
      </div>

      <h4 style={styles.title}>{session.task.title}</h4>
      <p style={styles.description}>{session.task.description}</p>

      <div style={styles.meta}>
        <span style={styles.metaItem}>Elapsed: {elapsed}</span>
        {session.gitBranch && (
          <span style={styles.metaItem}>Branch: {session.gitBranch}</span>
        )}
      </div>

      {/* Approval gate */}
      {isAwaitingReview && (
        <div style={styles.actions}>
          {!showReject ? (
            <>
              <button style={styles.approveBtn} onClick={onApprove}>
                Approve Spec
              </button>
              <button style={styles.rejectBtn} onClick={() => setShowReject(true)}>
                Request Changes
              </button>
            </>
          ) : (
            <div style={styles.feedbackBox}>
              <textarea
                placeholder="What should be changed?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                style={styles.feedbackInput}
                rows={3}
              />
              <div style={styles.feedbackActions}>
                <button
                  style={styles.rejectBtn}
                  onClick={() => {
                    onReject?.(feedback);
                    setFeedback('');
                    setShowReject(false);
                  }}
                  disabled={!feedback.trim()}
                >
                  Send Feedback
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowReject(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isActive && (
        <button style={styles.abortBtn} onClick={onAbort}>
          Abort Task
        </button>
      )}
    </div>
  );
};

function getElapsed(startedAt: string): string {
  const diff = Date.now() - new Date(startedAt).getTime();
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins > 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 8,
    padding: 16,
    borderLeft: '3px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskId: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  description: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    maxHeight: 60,
    overflow: 'hidden',
  },
  meta: {
    display: 'flex',
    gap: 12,
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  metaItem: {
    fontFamily: 'var(--font-mono)',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap' as const,
  },
  approveBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--accent-green)',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--accent-orange)',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  abortBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: 'var(--accent-red)',
    border: '1px solid var(--accent-red)',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  feedbackBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    width: '100%',
  },
  feedbackInput: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    resize: 'vertical' as const,
    outline: 'none',
  },
  feedbackActions: {
    display: 'flex',
    gap: 8,
  },
};
