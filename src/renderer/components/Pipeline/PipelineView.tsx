import React from 'react';
import { useStore, PipelineStage, STAGE_DISPLAY, ROLE_COLORS } from '../../store/sessionStore';

const PIPELINE_STEPS: { stage: PipelineStage; label: string; color: string }[] = [
  { stage: 'po', label: 'PO', color: ROLE_COLORS.po },
  { stage: 'awaiting_user_review', label: 'Review', color: '#eab308' },
  { stage: 'architect', label: 'Architect', color: ROLE_COLORS.architect },
  { stage: 'tech-lead', label: 'Tech Lead', color: ROLE_COLORS['tech-lead'] },
  { stage: 'developer', label: 'Dev', color: ROLE_COLORS.developer },
  { stage: 'tl-code-review', label: 'Code Review', color: ROLE_COLORS['tech-lead'] },
  { stage: 'qa', label: 'QA', color: ROLE_COLORS.qa },
  { stage: 'awaiting_merge_approval', label: 'Merge', color: '#eab308' },
  { stage: 'done', label: 'Done', color: '#22c55e' },
];

const STAGE_ORDER: PipelineStage[] = [
  'idle', 'po', 'awaiting_user_review', 'architect', 'tech-lead',
  'developer', 'parallel-dev', 'tl-code-review', 'qa',
  'awaiting_rejection_routing', 'awaiting_merge_approval', 'done',
];

export const PipelineView: React.FC = () => {
  const session = useStore((s) => s.session);
  const currentStage = session?.currentStage || 'idle';

  // Map parallel-dev to developer step position for visual display
  const effectiveStage = currentStage === 'parallel-dev' ? 'developer' : currentStage;
  const effectiveIdx = STAGE_ORDER.indexOf(effectiveStage);

  return (
    <div style={styles.container} className="pipeline-container">
      <div style={styles.label}>Pipeline</div>
      <div style={styles.steps}>
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STAGE_ORDER.indexOf(step.stage);
          const isActive = step.stage === effectiveStage
            || (step.stage === 'qa' && currentStage === 'awaiting_rejection_routing');
          const isCompleted = effectiveIdx > stepIdx && currentStage !== 'failed';
          const isFailed = currentStage === 'failed';
          const isRejected = step.stage === 'qa' && currentStage === 'awaiting_rejection_routing';

          const stepColor = isRejected ? 'var(--accent-red)' : step.color;

          return (
            <React.Fragment key={step.stage}>
              {i > 0 && (
                <div
                  style={{
                    ...styles.connector,
                    backgroundColor: isCompleted ? stepColor : 'var(--bg-tertiary)',
                  }}
                />
              )}
              <div
                style={{
                  ...styles.step,
                  borderColor: isActive
                    ? stepColor
                    : isCompleted
                    ? stepColor
                    : 'var(--bg-tertiary)',
                  backgroundColor: isActive
                    ? `${stepColor}22`
                    : isCompleted
                    ? `${stepColor}11`
                    : 'var(--bg-secondary)',
                  opacity: isFailed && !isCompleted && !isActive ? 0.4 : 1,
                }}
              >
                <div
                  className={isActive ? 'status-dot running' : ''}
                  style={{
                    ...styles.dot,
                    backgroundColor: isActive
                      ? stepColor
                      : isCompleted
                      ? stepColor
                      : 'var(--text-muted)',
                  }}
                />
                <span style={styles.stepLabel}>{step.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {session && (
        <div style={styles.stageInfo}>
          {currentStage === 'failed' && (
            <span style={{ color: 'var(--accent-red)' }}>Failed: {session.error}</span>
          )}
          {currentStage === 'done' && (
            <span style={{ color: 'var(--accent-green)' }}>Task completed successfully</span>
          )}
          {currentStage === 'awaiting_user_review' && (
            <span style={{ color: 'var(--accent-yellow)' }} className="needs-attention">
              Awaiting your review
            </span>
          )}
          {currentStage === 'parallel-dev' && (
            <span style={{ color: ROLE_COLORS.developer }}>
              Parallel development in progress
            </span>
          )}
          {currentStage === 'tl-code-review' && (
            <span style={{ color: ROLE_COLORS['tech-lead'] }}>
              Code review in progress
            </span>
          )}
          {currentStage === 'awaiting_rejection_routing' && (
            <span style={{ color: 'var(--accent-red)' }} className="needs-attention">
              QA rejected — action required
            </span>
          )}
          {currentStage === 'awaiting_merge_approval' && (
            <span style={{ color: 'var(--accent-yellow)' }} className="needs-attention">
              Ready for merge approval
            </span>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 20px',
    backgroundColor: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    overflowX: 'auto',
    flexShrink: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    minWidth: 60,
    flexShrink: 0,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  connector: {
    width: 24,
    height: 2,
    flexShrink: 0,
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid',
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 500,
  },
  stageInfo: {
    fontSize: 12,
    marginLeft: 'auto',
  },
};
