import React from 'react';
import { useStore, PipelineStage, ROLE_COLORS } from '../../store/sessionStore';

interface SetlistStep {
  label: string;
  stage: PipelineStage | 'awaiting_merge_approval' | 'parallel-dev';
  color: string;
}

const SETLIST_STEPS: SetlistStep[] = [
  { label: 'Overture', stage: 'po', color: ROLE_COLORS.po },
  { label: 'Review', stage: 'awaiting_user_review', color: '#eab308' },
  { label: 'Arrangement', stage: 'architect', color: ROLE_COLORS.architect },
  { label: 'Lead Solo', stage: 'tech-lead', color: ROLE_COLORS['tech-lead'] },
  { label: 'Rhythm Section', stage: 'developer', color: ROLE_COLORS.developer },
  { label: 'Code Review', stage: 'tl-code-review' as PipelineStage, color: ROLE_COLORS['tech-lead'] },
  { label: 'Sound Check', stage: 'qa', color: ROLE_COLORS.qa },
  { label: 'Encore', stage: 'awaiting_merge_approval' as PipelineStage, color: '#eab308' },
  { label: 'Final Bow', stage: 'done', color: '#22c55e' },
];

// Order used to determine completed / future steps
const STAGE_ORDER: string[] = [
  'idle',
  'po',
  'awaiting_user_review',
  'architect',
  'tech-lead',
  'developer',
  'parallel-dev',
  'tl-code-review',
  'qa',
  'awaiting_rejection_routing',
  'awaiting_merge_approval',
  'done',
];

function resolveStageIndex(stage: string): number {
  // Map parallel-dev to developer position
  if (stage === 'parallel-dev') return STAGE_ORDER.indexOf('developer');
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : -1;
}

function getStatusMessage(currentStage: string, error: string | null): string | null {
  switch (currentStage) {
    case 'awaiting_user_review':
      return 'Awaiting your review';
    case 'awaiting_merge_approval':
      return 'Awaiting merge approval';
    case 'awaiting_rejection_routing':
      return 'QA rejected \u2014 action required';
    case 'failed':
      return error ? `Failed: ${error}` : 'Pipeline failed';
    case 'done':
      return 'Task completed successfully';
    case 'rejected':
      return 'Changes rejected';
    default:
      return null;
  }
}

function getStatusColor(currentStage: string): string {
  switch (currentStage) {
    case 'awaiting_user_review':
    case 'awaiting_merge_approval':
      return 'var(--accent-yellow)';
    case 'awaiting_rejection_routing':
    case 'failed':
    case 'rejected':
      return 'var(--accent-red)';
    case 'done':
      return 'var(--accent-green)';
    default:
      return 'var(--text-secondary)';
  }
}

function needsPulse(currentStage: string, stepStage: string): boolean {
  if (
    currentStage === 'awaiting_user_review' &&
    stepStage === 'awaiting_user_review'
  )
    return true;
  if (
    currentStage === 'awaiting_merge_approval' &&
    stepStage === 'awaiting_merge_approval'
  )
    return true;
  return false;
}

export const SetlistBar: React.FC = () => {
  const session = useStore((s) => s.session);
  const currentStage: string = session?.currentStage || 'idle';
  const currentIdx = resolveStageIndex(currentStage);
  const isFailed = currentStage === 'failed';
  const isRejectionRouting = currentStage === 'awaiting_rejection_routing';

  const statusMsg = getStatusMessage(currentStage, session?.error ?? null);

  return (
    <div style={styles.container}>
      <div style={styles.steps}>
        {SETLIST_STEPS.map((step, i) => {
          const stepIdx = resolveStageIndex(step.stage);
          const isActive =
            step.stage === currentStage ||
            (currentStage === 'parallel-dev' && step.stage === 'developer');
          const isCompleted = !isFailed && currentIdx > stepIdx && stepIdx >= 0;
          const isFuture = !isActive && !isCompleted;
          const showRed =
            (isFailed && isActive) ||
            (isRejectionRouting && step.stage === 'qa');
          const pulse = needsPulse(currentStage, step.stage);

          const chipColor = showRed
            ? 'var(--accent-red)'
            : isActive
            ? step.color
            : isCompleted
            ? step.color
            : 'var(--text-muted)';

          return (
            <React.Fragment key={step.label}>
              {i > 0 && (
                <div
                  style={{
                    ...styles.connector,
                    backgroundColor: isCompleted
                      ? step.color
                      : 'var(--bg-tertiary)',
                  }}
                />
              )}
              <div
                className={pulse ? 'needs-attention' : undefined}
                style={{
                  ...styles.chip,
                  borderColor: isActive || showRed ? chipColor : 'transparent',
                  backgroundColor: isActive
                    ? `${chipColor}22`
                    : isCompleted
                    ? `${chipColor}11`
                    : 'var(--bg-secondary)',
                  opacity: isFuture && !showRed ? 0.45 : 1,
                }}
              >
                {isCompleted && <span style={styles.checkmark}>&#10003;</span>}
                <span
                  style={{
                    ...styles.chipLabel,
                    color: isActive || showRed ? '#fff' : isCompleted ? chipColor : 'var(--text-muted)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {statusMsg && (
        <div
          className={
            currentStage === 'awaiting_user_review' ||
            currentStage === 'awaiting_merge_approval'
              ? 'needs-attention'
              : undefined
          }
          style={{
            ...styles.statusInfo,
            color: getStatusColor(currentStage),
          }}
        >
          {statusMsg}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 16px',
    fontFamily: 'var(--font-sans)',
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  connector: {
    width: 16,
    height: 2,
    flexShrink: 0,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 10,
    border: '1px solid',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
  chipLabel: {
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1,
  },
  checkmark: {
    fontSize: 9,
    lineHeight: 1,
    color: 'var(--accent-green)',
  },
  statusInfo: {
    fontSize: 11,
    fontWeight: 500,
    marginLeft: 'auto',
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  },
};
