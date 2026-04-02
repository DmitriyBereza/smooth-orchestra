import React from 'react';
import { useStore, PipelineStage, STAGE_DISPLAY, ROLE_COLORS } from '../../store/sessionStore';

const PIPELINE_STEPS: { stage: PipelineStage; label: string; color: string }[] = [
  { stage: 'po', label: 'PO', color: ROLE_COLORS.po },
  { stage: 'awaiting_user_review', label: 'Review', color: '#eab308' },
  { stage: 'architect', label: 'Architect', color: ROLE_COLORS.architect },
  { stage: 'tech-lead', label: 'Tech Lead', color: ROLE_COLORS['tech-lead'] },
  { stage: 'developer', label: 'Developer', color: ROLE_COLORS.developer },
  { stage: 'qa', label: 'QA', color: ROLE_COLORS.qa },
  { stage: 'done', label: 'Done', color: '#22c55e' },
];

const STAGE_ORDER = ['idle', 'po', 'awaiting_user_review', 'architect', 'tech-lead', 'developer', 'qa', 'done'];

export const PipelineView: React.FC = () => {
  const session = useStore((s) => s.session);
  const currentStage = session?.currentStage || 'idle';

  const currentIdx = STAGE_ORDER.indexOf(currentStage);

  return (
    <div style={styles.container}>
      <div style={styles.label}>Pipeline</div>
      <div style={styles.steps}>
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STAGE_ORDER.indexOf(step.stage);
          const isActive = step.stage === currentStage;
          const isCompleted = currentIdx > stepIdx && currentStage !== 'failed';
          const isFailed = currentStage === 'failed';

          return (
            <React.Fragment key={step.stage}>
              {i > 0 && (
                <div
                  style={{
                    ...styles.connector,
                    backgroundColor: isCompleted ? step.color : 'var(--bg-tertiary)',
                  }}
                />
              )}
              <div
                style={{
                  ...styles.step,
                  borderColor: isActive
                    ? step.color
                    : isCompleted
                    ? step.color
                    : 'var(--bg-tertiary)',
                  backgroundColor: isActive
                    ? `${step.color}22`
                    : isCompleted
                    ? `${step.color}11`
                    : 'var(--bg-secondary)',
                  opacity: isFailed && !isCompleted && !isActive ? 0.4 : 1,
                }}
              >
                <div
                  className={isActive ? 'status-dot running' : ''}
                  style={{
                    ...styles.dot,
                    backgroundColor: isActive
                      ? step.color
                      : isCompleted
                      ? step.color
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
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    minWidth: 60,
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
