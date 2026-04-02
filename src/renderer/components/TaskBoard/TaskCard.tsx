import React from 'react';
import { SessionState, STAGE_DISPLAY, PipelineStage } from '../../store/sessionStore';

interface TaskCardProps {
  session: SessionState;
  onApprove?: () => void;
  onReject?: (feedback: string) => void;
  onAbort?: () => void;
  onRouteRejection?: (routing: 'send_to_dev' | 'escalate_to_po') => void;
  onApproveMerge?: () => void;
  onRejectMerge?: (feedback: string) => void;
}

function getStageColor(stage: PipelineStage): string {
  switch (stage) {
    case 'done': return '#ffd700';
    case 'failed': return '#ff4500';
    case 'rejected': return '#ff4500';
    case 'awaiting_rejection_routing': return '#ff4500';
    case 'awaiting_user_review': return '#ffd700';
    case 'awaiting_merge_approval': return '#ffd700';
    default: return '#9b59b6';
  }
}

export const TaskCard: React.FC<TaskCardProps> = ({ session, onApprove, onReject, onAbort, onRouteRejection, onApproveMerge, onRejectMerge }) => {
  const [feedback, setFeedback] = React.useState('');
  const [showReject, setShowReject] = React.useState(false);
  const [showMergeReject, setShowMergeReject] = React.useState(false);
  const [mergeFeedback, setMergeFeedback] = React.useState('');

  const isAwaitingReview = session.currentStage === 'awaiting_user_review';
  const isAwaitingMergeApproval = session.currentStage === 'awaiting_merge_approval';
  const isActive = !['done', 'failed', 'idle'].includes(session.currentStage);
  const elapsed = getElapsed(session.startedAt);

  return (
    <div
      style={{
        ...styles.card,
        borderLeftColor: getStageColor(session.currentStage),
      }}
      className={isAwaitingReview || isAwaitingMergeApproval ? 'needs-attention' : ''}
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

      {/* Spec approval gate */}
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

      {session.currentStage === 'awaiting_rejection_routing' && (
        <div style={styles.actions}>
          <div style={{ ...styles.feedbackBox, borderLeft: '3px solid var(--accent-red)' }}>
            <p style={{ color: 'var(--accent-red)', fontWeight: 600, fontSize: 12, margin: 0 }}>
              QA Rejected
            </p>
            {session.rejectionReason && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0' }}>
                {session.rejectionReason}
              </p>
            )}
            <div style={styles.feedbackActions}>
              <button style={styles.rejectBtn} onClick={() => onRouteRejection?.('send_to_dev')}>
                Send Back to Dev
              </button>
              <button
                style={{ ...styles.cancelBtn, color: 'var(--accent-red)' }}
                onClick={() => onRouteRejection?.('escalate_to_po')}
              >
                Escalate to PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge approval gate */}
      {isAwaitingMergeApproval && (
        <div style={styles.actions}>
          {!showMergeReject ? (
            <>
              <button style={styles.approveBtn} onClick={onApproveMerge}>
                Approve Merge
              </button>
              <button style={styles.rejectBtn} onClick={() => setShowMergeReject(true)}>
                Request Changes
              </button>
            </>
          ) : (
            <div style={styles.feedbackBox}>
              <textarea
                placeholder="What needs to change before merge?"
                value={mergeFeedback}
                onChange={(e) => setMergeFeedback(e.target.value)}
                style={styles.feedbackInput}
                rows={3}
              />
              <div style={styles.feedbackActions}>
                <button
                  style={styles.rejectBtn}
                  onClick={() => {
                    onRejectMerge?.(mergeFeedback);
                    setMergeFeedback('');
                    setShowMergeReject(false);
                  }}
                  disabled={!mergeFeedback.trim()}
                >
                  Send Feedback
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowMergeReject(false)}
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
    backgroundColor: 'rgba(15, 15, 35, 0.8)',
    borderRadius: 10,
    padding: 16,
    borderLeft: '3px solid',
    border: '1px solid rgba(255, 215, 0, 0.08)',
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
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.03em',
    color: 'var(--text-primary)',
  },
  description: {
    fontSize: 12,
    fontFamily: 'var(--font-typewriter)',
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
    backgroundColor: '#ffd700',
    color: '#050505',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 16px',
    backgroundColor: '#ff4500',
    color: '#e8dcc8',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: 'rgba(42, 42, 74, 0.6)',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
  abortBtn: {
    padding: '6px 16px',
    backgroundColor: 'transparent',
    color: '#ff4500',
    border: '1px solid #ff4500',
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
    backgroundColor: 'rgba(10, 10, 20, 0.6)',
    border: '1px solid rgba(255, 215, 0, 0.15)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-typewriter)',
    resize: 'vertical' as const,
    outline: 'none',
  },
  feedbackActions: {
    display: 'flex',
    gap: 8,
  },
};
