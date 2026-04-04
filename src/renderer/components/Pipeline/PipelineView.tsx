import React from 'react';
import { useStore, PipelineStage, STAGE_DISPLAY, ROLE_COLORS, PipelineType } from '../../store/sessionStore';
import { SHARED_PIPELINE_CONFIGS, COMMON_BOOKEND_STAGES } from '../../../shared/pipeline-configs';

/** Get pipeline steps for visualization based on pipeline type */
function getPipelineSteps(pipelineType: PipelineType = 'development'): { stage: PipelineStage; label: string; color: string }[] {
  const config = SHARED_PIPELINE_CONFIGS[pipelineType];
  const steps: { stage: PipelineStage; label: string; color: string }[] = [];

  // Common bookend: PO
  steps.push({ stage: 'po', label: 'PO', color: ROLE_COLORS.po });
  // Review gate
  steps.push({ stage: 'awaiting_user_review', label: 'Review', color: '#eab308' });
  // Pipeline-type-specific active stages (from default pipeline, in order)
  for (const stageId of config.defaultPipeline) {
    const stageConfig = config.allStages.find((s) => s.stage === stageId);
    if (stageConfig) {
      steps.push({
        stage: stageId as PipelineStage,
        label: stageConfig.label,
        color: stageConfig.color,
      });
    }
  }
  // Merge gate
  steps.push({ stage: 'awaiting_merge_approval', label: 'Merge', color: '#eab308' });
  // Done
  steps.push({ stage: 'done', label: 'Done', color: '#22c55e' });

  return steps;
}

/** Get stage order for progress determination */
function getStageOrder(pipelineType: PipelineType = 'development'): PipelineStage[] {
  const config = SHARED_PIPELINE_CONFIGS[pipelineType];
  return [
    'idle',
    'po',
    'awaiting_user_review',
    ...config.defaultPipeline,
    'awaiting_rejection_routing',
    'awaiting_merge_approval',
    'done',
  ] as PipelineStage[];
}

/** Get a human-friendly status message for the current stage */
function getStageInfo(stage: PipelineStage, pipelineType: PipelineType): React.ReactNode {
  switch (stage) {
    case 'failed':
      return null; // Handled by parent
    case 'done':
      return <span style={{ color: 'var(--accent-green)' }}>Task completed successfully</span>;
    case 'awaiting_user_review':
      return <span style={{ color: 'var(--accent-yellow)' }} className="needs-attention">Awaiting your review</span>;
    case 'awaiting_rejection_routing':
      return <span style={{ color: 'var(--accent-red)' }} className="needs-attention">QA rejected — action required</span>;
    case 'awaiting_merge_approval':
      return <span style={{ color: 'var(--accent-yellow)' }} className="needs-attention">Ready for approval</span>;
    case 'parallel-dev':
      return <span style={{ color: ROLE_COLORS.developer }}>Parallel development in progress</span>;
    case 'tl-code-review':
      return <span style={{ color: ROLE_COLORS['tech-lead'] }}>Code review in progress</span>;
    case 'creative-director':
      return <span style={{ color: ROLE_COLORS['creative-director'] }}>Creative review in progress</span>;
    case 'design-reviewer':
      return <span style={{ color: ROLE_COLORS['design-reviewer'] }}>Design review in progress</span>;
    default: {
      // Show display name for any active stage
      const displayName = STAGE_DISPLAY[stage];
      if (displayName && stage !== 'idle' && stage !== 'scheduled') {
        return <span style={{ color: 'var(--text-secondary)' }}>{displayName} in progress</span>;
      }
      return null;
    }
  }
}

export const PipelineView: React.FC = () => {
  const session = useStore((s) => s.session);
  const currentStage = session?.currentStage || 'idle';
  const pipelineType: PipelineType = session?.pipelineType ?? session?.task?.pipelineType ?? 'development';

  // Get pipeline steps and order for this pipeline type
  const PIPELINE_STEPS = getPipelineSteps(pipelineType);
  const STAGE_ORDER = getStageOrder(pipelineType);

  // Map parallel-dev to developer step position for visual display
  const effectiveStage = currentStage === 'parallel-dev' ? 'developer' : currentStage;
  const effectiveIdx = STAGE_ORDER.indexOf(effectiveStage);

  const stageInfo = getStageInfo(currentStage, pipelineType);

  return (
    <div style={styles.container} className="pipeline-container">
      <div style={styles.label}>Pipeline</div>
      <div style={styles.steps}>
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STAGE_ORDER.indexOf(step.stage);
          const isActive = step.stage === effectiveStage
            || (step.stage === (SHARED_PIPELINE_CONFIGS[pipelineType].allStages.slice(-1)[0]?.stage) && currentStage === 'awaiting_rejection_routing');
          const isQaRejected = currentStage === 'awaiting_rejection_routing';
          // Highlight the QA stage (last pipeline stage) when rejected
          const isQaStage = step.stage === SHARED_PIPELINE_CONFIGS[pipelineType].allStages.slice(-1)[0]?.stage;
          const isRejected = isQaStage && isQaRejected;

          const isCompleted = effectiveIdx > stepIdx && currentStage !== 'failed';
          const isFailed = currentStage === 'failed';

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
          {stageInfo}
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
