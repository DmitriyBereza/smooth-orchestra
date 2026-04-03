import React, { useEffect, useState } from 'react';
import { SessionState, STAGE_DISPLAY, PipelineStage } from '../../store/sessionStore';
import { ArtifactViewer } from './ArtifactViewer';

interface TaskCardProps {
  session: SessionState;
  onApprove?: () => void;
  onReject?: (feedback: string) => void;
  onAnswerQuestions?: (answers: string) => void;
  onAbort?: () => void;
  onRouteRejection?: (routing: 'send_to_dev' | 'escalate_to_po') => void;
  onApproveMerge?: () => void;
  onRejectMerge?: (feedback: string) => void;
}

function getStageColor(stage: PipelineStage): string {
  switch (stage) {
    case 'done': return 'var(--accent-green)';
    case 'failed': return 'var(--accent-red)';
    case 'rejected': return 'var(--accent-red)';
    case 'awaiting_rejection_routing': return 'var(--accent-red)';
    case 'awaiting_user_review': return 'var(--accent-yellow)';
    case 'awaiting_merge_approval': return 'var(--accent-yellow)';
    case 'scheduled': return 'var(--accent-purple)';
    default: return 'var(--accent-blue)';
  }
}

function useCountdown(targetIso: string | null | undefined): string | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!targetIso) { setRemaining(null); return; }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Starting...'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return remaining;
}

export const TaskCard: React.FC<TaskCardProps> = ({ session, onApprove, onReject, onAnswerQuestions, onAbort, onRouteRejection, onApproveMerge, onRejectMerge }) => {
  const [feedback, setFeedback] = React.useState('');
  const [showReject, setShowReject] = React.useState(false);
  const [showAnswerQuestions, setShowAnswerQuestions] = React.useState(false);
  const [questionAnswers, setQuestionAnswers] = React.useState('');
  const [showMergeReject, setShowMergeReject] = React.useState(false);
  const [mergeFeedback, setMergeFeedback] = React.useState('');
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [hasQuestions, setHasQuestions] = React.useState(false);

  // Check if the PO wrote questions
  useEffect(() => {
    if (session.currentStage === 'awaiting_user_review') {
      fetch(`/api/artifacts/${encodeURIComponent(session.task.id)}/questions`)
        .then((res) => { setHasQuestions(res.ok); })
        .catch(() => { setHasQuestions(false); });
    } else {
      setHasQuestions(false);
    }
  }, [session.currentStage, session.task.id]);

  const isAwaitingReview = session.currentStage === 'awaiting_user_review';
  const isAwaitingMergeApproval = session.currentStage === 'awaiting_merge_approval';
  const isScheduled = session.currentStage === 'scheduled';
  const isActive = !['done', 'failed', 'idle'].includes(session.currentStage);
  const elapsed = getElapsed(session.startedAt);
  const countdown = useCountdown(session.scheduledAt);

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
      <p
        style={{
          ...styles.description,
          ...(descExpanded ? { maxHeight: 'none', cursor: 'pointer' } : { cursor: 'pointer' }),
        }}
        onClick={() => setDescExpanded(!descExpanded)}
        title={descExpanded ? 'Click to collapse' : 'Click to expand'}
      >
        {session.task.description}
      </p>

      <div style={styles.meta}>
        {!isScheduled && <span style={styles.metaItem}>Elapsed: {elapsed}</span>}
        {session.gitBranch && (
          <span style={styles.metaItem}>Branch: {session.gitBranch}</span>
        )}
      </div>

      {/* Artifact viewers for review stages */}
      {isAwaitingReview && (
        <>
          <ArtifactViewer
            taskId={session.task.id}
            artifactType="story"
            label="PO Spec"
          />
          {hasQuestions && (
            <ArtifactViewer
              taskId={session.task.id}
              artifactType="questions"
              label="PO Questions"
            />
          )}
        </>
      )}

      {isAwaitingMergeApproval && (
        <>
          <ArtifactViewer
            taskId={session.task.id}
            artifactType="qa-report"
            label="QA Report"
          />
          <ArtifactViewer
            taskId={session.task.id}
            artifactType="dev-notes"
            label="Dev Notes"
          />
        </>
      )}

      {session.currentStage === 'awaiting_rejection_routing' && (
        <ArtifactViewer
          taskId={session.task.id}
          artifactType="qa-report"
          label="QA Report"
        />
      )}

      {/* Scheduled countdown */}
      {isScheduled && countdown && (
        <div style={styles.countdown}>
          <span style={styles.countdownLabel}>Starts in</span>
          <span style={styles.countdownValue}>{countdown}</span>
        </div>
      )}

      {/* Spec approval gate */}
      {isAwaitingReview && (
        <div style={styles.actions}>
          {!showReject && !showAnswerQuestions ? (
            <>
              <button style={styles.approveBtn} onClick={onApprove}>
                Approve Spec
              </button>
              {hasQuestions && (
                <button style={styles.answerBtn} onClick={() => setShowAnswerQuestions(true)}>
                  Answer Questions
                </button>
              )}
              <button style={styles.rejectBtn} onClick={() => setShowReject(true)}>
                Request Changes
              </button>
            </>
          ) : showAnswerQuestions ? (
            <div style={styles.feedbackBox}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)', marginBottom: 4 }}>
                Answer the PO's questions
              </div>
              <textarea
                placeholder="Type your answers here... The PO will incorporate them and update the spec."
                value={questionAnswers}
                onChange={(e) => setQuestionAnswers(e.target.value)}
                style={styles.feedbackInput}
                rows={5}
                autoFocus
              />
              <div style={styles.feedbackActions}>
                <button
                  style={styles.answerBtn}
                  onClick={() => {
                    onAnswerQuestions?.(questionAnswers);
                    setQuestionAnswers('');
                    setShowAnswerQuestions(false);
                  }}
                  disabled={!questionAnswers.trim()}
                >
                  Send Answers
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowAnswerQuestions(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={styles.feedbackBox}>
              <textarea
                placeholder="What should be changed in the spec?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                style={styles.feedbackInput}
                rows={3}
                autoFocus
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
  answerBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--accent-blue)',
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
  countdown: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 6,
  },
  countdownLabel: {
    fontSize: 12,
    color: 'var(--accent-purple)',
    fontWeight: 600,
  },
  countdownValue: {
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    color: 'var(--accent-purple)',
  },
};
