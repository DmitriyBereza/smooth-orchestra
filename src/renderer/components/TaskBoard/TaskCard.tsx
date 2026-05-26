import React, { useEffect, useState } from 'react';
import { SessionState, STAGE_DISPLAY, PipelineStage, PipelineType } from '../../store/sessionStore';
import { ArtifactViewer } from './ArtifactViewer';
import { SHARED_PIPELINE_CONFIGS } from '../../../shared/pipeline-configs';
import { Circle, CircleNotch, CheckCircle, XCircle, Megaphone, Palette } from '@phosphor-icons/react';
import { ROLE_COLOR } from '../../utils/roleColors';

interface TaskCardProps {
  session: SessionState;
  onApprove?: (pipeline: string[]) => void;
  onReject?: (feedback: string) => void;
  onAnswerQuestions?: (answers: string) => void;
  onAbort?: () => void;
  onRestart?: () => void;
  onRouteRejection?: (routing: 'send_to_dev' | 'escalate_to_po') => void;
  onApproveMerge?: (skipMerge?: boolean) => void;
  onRejectMerge?: (feedback: string) => void;
}

function SubtaskIcon({ status, role }: { status: string; role: string }) {
  const roleColor = ROLE_COLOR[role] || 'var(--text-muted)';
  switch (status) {
    case 'running':
      return <CircleNotch weight="bold" size={12} className="spin" style={{ color: roleColor }} />;
    case 'completed':
      return <CheckCircle weight="fill" size={12} style={{ color: 'var(--state-success)' }} />;
    case 'failed':
      return <XCircle weight="fill" size={12} style={{ color: 'var(--state-error)' }} />;
    default:
      return <Circle weight="bold" size={12} style={{ color: 'var(--text-muted)' }} />;
  }
}

/** Extract PR URL from the dev-notes artifact (## PR section) */
function PrLink({ taskId }: { taskId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // Fetch dev-notes artifact and parse the ## PR section for a GitHub URL
    fetch(`/api/artifacts/${taskId}/dev-notes`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((text) => {
        const m = text.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/);
        if (m) setUrl(m[0]);
      })
      .catch(() => {});
  }, [taskId]);

  if (!url) return null;
  return (
    <div style={{ padding: '4px 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: 'var(--brand-primary)', textDecoration: 'underline' }}
      >
        {url}
      </a>
    </div>
  );
}

/** Get pipeline stage options and config for the session's pipeline type */
function getPipelineStageOptions(pipelineType: PipelineType = 'development') {
  const config = SHARED_PIPELINE_CONFIGS[pipelineType];
  return config.allStages.map(({ stage, label, description }) => ({ stage, label, description }));
}

function getDefaultPipeline(pipelineType: PipelineType = 'development'): string[] {
  return SHARED_PIPELINE_CONFIGS[pipelineType].defaultPipeline;
}

function getRequiredStage(pipelineType: PipelineType = 'development'): string {
  return SHARED_PIPELINE_CONFIGS[pipelineType].requiredStage;
}

/** Determine which artifact viewers to show for the merge approval screen */
function getMergeApprovalArtifacts(pipelineType: PipelineType = 'development'): { type: string; label: string }[] {
  switch (pipelineType) {
    case 'marketing':
      return [
        { type: 'marketing-qa-report', label: 'Marketing QA Report' },
        { type: 'copy', label: 'Copy' },
      ];
    case 'design':
      return [
        { type: 'design-qa-report', label: 'Design QA Report' },
        { type: 'design-spec', label: 'Design Spec' },
      ];
    default:
      return [
        { type: 'qa-report', label: 'QA Report' },
        { type: 'dev-notes', label: 'Dev Notes' },
      ];
  }
}

/** Determine which artifact type represents the "QA report" for rejection routing */
function getQaReportArtifact(pipelineType: PipelineType = 'development'): string {
  switch (pipelineType) {
    case 'marketing': return 'marketing-qa-report';
    case 'design': return 'design-qa-report';
    default: return 'qa-report';
  }
}

/** Get the rejection routing label for the "send to doer" button */
function getSendToDoerLabel(pipelineType: PipelineType = 'development'): string {
  switch (pipelineType) {
    case 'marketing': return 'Send Back to Copywriter';
    case 'design': return 'Send Back to UI Designer';
    default: return 'Send Back to Dev';
  }
}

function getStageColor(stage: PipelineStage): string {
  switch (stage) {
    case 'done': return 'var(--state-success)';
    case 'failed': return 'var(--state-error)';
    case 'rejected': return 'var(--state-error)';
    case 'awaiting_rejection_routing': return 'var(--state-error)';
    case 'awaiting_user_review': return 'var(--state-warning)';
    case 'awaiting_merge_approval': return 'var(--state-warning)';
    case 'scheduled': return 'var(--role-architect)';
    default: return 'var(--brand-primary)';
  }
}

function getStageBgColor(stage: PipelineStage): string {
  switch (stage) {
    case 'done': return 'var(--state-success-muted)';
    case 'failed': return 'var(--state-error-muted)';
    case 'rejected': return 'var(--state-error-muted)';
    case 'awaiting_rejection_routing': return 'var(--state-error-muted)';
    case 'awaiting_user_review': return 'var(--state-warning-muted)';
    case 'awaiting_merge_approval': return 'var(--state-warning-muted)';
    case 'scheduled': return 'rgba(206,147,216,0.13)';
    default: return 'var(--brand-primary-muted)';
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}m ${s}s`;
}

function getElapsedSeconds(startedAt: string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
}

function useCountdown(targetIso: string | null | undefined): string | null {
  const [remaining, setRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (!targetIso) { setRemaining(null); return; }
    const update = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (diff <= 0) { setRemaining('starting...'); return; }
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

export const TaskCard: React.FC<TaskCardProps> = ({ session, onApprove, onReject, onAnswerQuestions, onAbort, onRestart, onRouteRejection, onApproveMerge, onRejectMerge }) => {
  const [feedback, setFeedback] = React.useState('');
  const [showReject, setShowReject] = React.useState(false);
  const [showAnswerQuestions, setShowAnswerQuestions] = React.useState(false);
  const [questionAnswers, setQuestionAnswers] = React.useState('');
  const [showMergeReject, setShowMergeReject] = React.useState(false);
  const [mergeFeedback, setMergeFeedback] = React.useState('');
  const [descExpanded, setDescExpanded] = React.useState(false);
  const [hasQuestions, setHasQuestions] = React.useState(false);

  const pipelineType: PipelineType = session.pipelineType ?? session.task?.pipelineType ?? 'development';

  const PIPELINE_STAGE_OPTIONS = getPipelineStageOptions(pipelineType);
  const DEFAULT_FULL_PIPELINE = getDefaultPipeline(pipelineType);
  const requiredStage = getRequiredStage(pipelineType);
  const mergeArtifacts = getMergeApprovalArtifacts(pipelineType);
  const qaReportArtifact = getQaReportArtifact(pipelineType);
  const sendToDoerLabel = getSendToDoerLabel(pipelineType);

  const [selectedPipeline, setSelectedPipeline] = React.useState<string[]>(
    session.proposedPipeline ?? DEFAULT_FULL_PIPELINE,
  );

  useEffect(() => {
    if (session.proposedPipeline) {
      setSelectedPipeline(session.proposedPipeline);
    }
  }, [session.proposedPipeline?.join(',')]);

  const toggleStage = (stage: string) => {
    if (stage === requiredStage) return;
    setSelectedPipeline((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  };

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
  const isFailed = session.currentStage === 'failed';
  const isNeedsAttention = isAwaitingReview || isAwaitingMergeApproval;

  const elapsedSeconds = getElapsedSeconds(session.startedAt);
  const elapsedDisplay = formatElapsed(elapsedSeconds);
  const countdown = useCountdown(session.scheduledAt);

  // Determine active role for left border color
  const activeRole = session.currentStage as string;
  const roleBorderColor = ROLE_COLOR[activeRole] || getStageColor(session.currentStage);

  return (
    <div
      style={{
        ...styles.card,
        borderLeft: isNeedsAttention
          ? undefined  // signal-attention-card class handles this
          : `3px solid ${roleBorderColor}`,
      }}
      className={isNeedsAttention ? 'signal-attention-card' : ''}
    >
      <div style={styles.header}>
        <span style={styles.taskId}>{session.task.id}</span>
        {session.jiraIssueKey && (
          <span style={styles.jiraBadge} title={`Linked Jira issue: ${session.jiraIssueKey}`}>
            {session.jiraIssueKey}
          </span>
        )}
        {/* Pipeline type badge */}
        {pipelineType !== 'development' && (
          <span style={{
            ...styles.pipelineTypeBadge,
            ...(pipelineType === 'marketing' ? styles.pipelineTypeBadgeMarketing : styles.pipelineTypeBadgeDesign),
          }}>
            {pipelineType === 'marketing' ? <Megaphone weight="bold" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <Palette weight="bold" size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />} {SHARED_PIPELINE_CONFIGS[pipelineType].displayName}
          </span>
        )}
        <span
          style={{
            ...styles.badge,
            backgroundColor: getStageBgColor(session.currentStage),
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
        {session.projectName && (
          <span style={styles.metaItem}>project: {session.projectName}</span>
        )}
        {!isScheduled && (
          <span style={styles.metaItem}>elapsed: {elapsedDisplay}</span>
        )}
        {session.gitBranch && (
          <span style={styles.metaItem}>branch: {session.gitBranch}</span>
        )}
      </div>

      {/* Artifact viewers for review stages */}
      {isAwaitingReview && (
        <>
          <ArtifactViewer
            taskId={session.task.id}
            artifactType="story"
            label="Spec"
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

      {/* Merge approval artifacts */}
      {isAwaitingMergeApproval && mergeArtifacts.map(({ type, label }) => (
        <ArtifactViewer
          key={type}
          taskId={session.task.id}
          artifactType={type as any}
          label={label}
        />
      ))}

      {/* QA rejection artifact */}
      {session.currentStage === 'awaiting_rejection_routing' && (
        <ArtifactViewer
          taskId={session.task.id}
          artifactType={qaReportArtifact as any}
          label="QA Report"
        />
      )}

      {/* Scheduled countdown */}
      {isScheduled && countdown && (
        <div style={styles.countdown}>
          <span style={styles.countdownLabel}>starts in</span>
          <span style={styles.countdownValue}>{countdown}</span>
        </div>
      )}

      {/* Spec approval gate */}
      {isAwaitingReview && (
        <div style={styles.actions}>
          {!showReject && !showAnswerQuestions ? (
            <>
              {/* Pipeline selector */}
              <div style={styles.pipelineSelector}>
                <div style={styles.pipelineSelectorHeader}>
                  <span style={styles.pipelineSelectorTitle}>Pipeline</span>
                  {session.proposedPipeline && (
                    <span style={styles.pipelineBadge}>PO suggested</span>
                  )}
                </div>
                <div style={styles.pipelineStages}>
                  {PIPELINE_STAGE_OPTIONS.map(({ stage, label, description }) => {
                    const isSelected = selectedPipeline.includes(stage);
                    const isRequired = stage === requiredStage;
                    return (
                      <button
                        key={stage}
                        title={description}
                        onClick={() => toggleStage(stage)}
                        style={{
                          ...styles.stageToggle,
                          ...(isSelected ? styles.stageToggleOn : styles.stageToggleOff),
                          ...(isRequired ? styles.stageToggleRequired : {}),
                        }}
                        disabled={isRequired}
                      >
                        {isSelected ? '✓' : '○'} {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button style={styles.approveBtn} onClick={() => onApprove?.(
                PIPELINE_STAGE_OPTIONS.map((o) => o.stage).filter((s) => selectedPipeline.includes(s)),
              )}>
                ./approve
              </button>
              {hasQuestions && (
                <button style={styles.answerBtn} onClick={() => setShowAnswerQuestions(true)}>
                  ./query
                </button>
              )}
              <button style={styles.rejectBtn} onClick={() => setShowReject(true)}>
                ./reject
              </button>
            </>
          ) : showAnswerQuestions ? (
            <div style={styles.feedbackBox}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-bold)', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                answer the PO's questions
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
                  ./send
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowAnswerQuestions(false)}
                >
                  cancel
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
                  ./send
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowReject(false)}
                >
                  cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rejection routing */}
      {session.currentStage === 'awaiting_rejection_routing' && (
        <div style={styles.actions}>
          <div style={{ ...styles.feedbackBox, borderLeft: '3px solid var(--state-error)' }}>
            <p style={{ color: 'var(--state-error)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', margin: 0 }}>
              QA rejected
            </p>
            {session.rejectionReason && (
              <p style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: '4px 0' }}>
                {session.rejectionReason}
              </p>
            )}
            <div style={styles.feedbackActions}>
              <button style={styles.rejectBtn} onClick={() => onRouteRejection?.('send_to_dev')}>
                {sendToDoerLabel}
              </button>
              <button
                style={{ ...styles.cancelBtn, color: 'var(--state-error)' }}
                onClick={() => onRouteRejection?.('escalate_to_po')}
              >
                escalate to PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PR link — shown at merge approval stage */}
      {isAwaitingMergeApproval && session.task?.id && (
        <PrLink taskId={session.task.id} />
      )}

      {/* Merge approval gate */}
      {isAwaitingMergeApproval && (
        <div style={styles.actions}>
          {!showMergeReject ? (
            <>
              <button style={styles.approveBtn} onClick={() => onApproveMerge?.()}>
                ./approve
              </button>
              <button style={{ ...styles.approveBtn, backgroundColor: 'var(--role-architect)' }} onClick={() => onApproveMerge?.(true)}>
                ./approve (no merge)
              </button>
              <button style={styles.rejectBtn} onClick={() => setShowMergeReject(true)}>
                ./reject
              </button>
            </>
          ) : (
            <div style={styles.feedbackBox}>
              <textarea
                placeholder="What needs to change before approval?"
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
                  ./send
                </button>
                <button
                  style={styles.cancelBtn}
                  onClick={() => setShowMergeReject(false)}
                >
                  cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isActive && (
        <button style={styles.abortBtn} onClick={onAbort}>
          abort
        </button>
      )}

      {isFailed && (
        <button
          style={{ ...styles.approveBtn, backgroundColor: 'var(--brand-primary)' }}
          onClick={onRestart}
        >
          ./restart
        </button>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-xl)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  taskId: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-code)',
  },
  jiraBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--jira-badge-bg)',
    color: 'var(--jira-badge-color)',
    border: '1px solid var(--jira-badge-border)',
    textDecoration: 'none',
    letterSpacing: '0.03em',
  },
  pipelineTypeBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-md)',
  },
  pipelineTypeBadgeMarketing: {
    backgroundColor: 'rgba(255,64,129,0.15)',
    color: 'var(--pipeline-marketing-color)',
  },
  pipelineTypeBadgeDesign: {
    backgroundColor: 'rgba(206,147,216,0.15)',
    color: 'var(--pipeline-design-color)',
  },
  badge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    padding: '2px 8px',
    borderRadius: 'var(--radius-md)',
  },
  title: {
    fontSize: 'var(--text-md)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
  },
  description: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    maxHeight: '60px',
    overflow: 'hidden',
    fontFamily: 'var(--font-body)',
  },
  meta: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const,
  },
  metaItem: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--text-muted)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '8px',
    flexWrap: 'wrap' as const,
  },
  approveBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--state-success)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  answerBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--role-po)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  rejectBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--role-techlead)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '6px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  abortBtn: {
    padding: '4px 0',
    backgroundColor: 'transparent',
    color: 'var(--state-error)',
    border: 'none',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    marginTop: '4px',
  },
  feedbackBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '100%',
  },
  feedbackInput: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    resize: 'vertical' as const,
    outline: 'none',
  },
  feedbackActions: {
    display: 'flex',
    gap: '8px',
  },
  pipelineSelector: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-input)',
  },
  pipelineSelectorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  pipelineSelectorTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  pipelineBadge: {
    fontSize: 'var(--text-xs)',
    padding: '1px 6px',
    backgroundColor: 'var(--brand-muted)',
    color: 'var(--brand-primary)',
    borderRadius: 'var(--radius-md)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
  },
  pipelineStages: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  stageToggle: {
    padding: '4px 10px',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    cursor: 'pointer',
  },
  stageToggleOn: {
    backgroundColor: 'rgba(0,230,118,0.15)',
    borderColor: 'var(--state-success)',
    color: 'var(--state-success)',
  },
  stageToggleOff: {
    backgroundColor: 'transparent',
    borderColor: 'var(--border-input)',
    color: 'var(--text-muted)',
  },
  stageToggleRequired: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  countdown: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'rgba(206,147,216,0.1)',
    borderRadius: 'var(--radius-lg)',
  },
  countdownLabel: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--role-architect)',
    fontWeight: 'var(--weight-semibold)',
  },
  countdownValue: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--role-architect)',
  },
};
