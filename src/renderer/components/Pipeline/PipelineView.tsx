import React from 'react';
import { useStore, PipelineStage, STAGE_DISPLAY, ROLE_COLORS, PipelineType } from '../../store/sessionStore';
import { SHARED_PIPELINE_CONFIGS, COMMON_BOOKEND_STAGES } from '../../../shared/pipeline-configs';
import {
  FileText, TreeStructure, Code, ShieldCheck, BugBeetle,
} from '@phosphor-icons/react';
import { ROLE_COLOR } from '../../utils/roleColors';

const ROLE_ICON: Record<string, React.ReactElement> = {
  po:        <FileText weight="fill" size={12} />,
  architect: <TreeStructure weight="fill" size={12} />,
  developer: <Code weight="fill" size={12} />,
  techlead:  <ShieldCheck weight="fill" size={12} />,
  'tech-lead': <ShieldCheck weight="fill" size={12} />,
  qa:        <BugBeetle weight="fill" size={12} />,
};

/** Get pipeline steps for visualization based on pipeline type */
function getPipelineSteps(pipelineType: PipelineType = 'development'): { stage: PipelineStage; label: string; color: string; role: string }[] {
  const config = SHARED_PIPELINE_CONFIGS[pipelineType];
  const steps: { stage: PipelineStage; label: string; color: string; role: string }[] = [];

  // Common bookend: PO
  steps.push({ stage: 'po', label: 'PO', color: ROLE_COLORS.po, role: 'po' });
  // Review gate
  steps.push({ stage: 'awaiting_user_review', label: 'Review', color: 'var(--state-warning)', role: '' });
  // Pipeline-type-specific active stages (from default pipeline, in order)
  for (const stageId of config.defaultPipeline) {
    const stageConfig = config.allStages.find((s) => s.stage === stageId);
    if (stageConfig) {
      steps.push({
        stage: stageId as PipelineStage,
        label: stageConfig.label,
        color: stageConfig.color,
        role: stageId,
      });
    }
  }
  // Merge gate
  steps.push({ stage: 'awaiting_merge_approval', label: 'Merge', color: 'var(--state-warning)', role: '' });
  // Done
  steps.push({ stage: 'done', label: 'Done', color: 'var(--state-success)', role: '' });

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
      return null;
    case 'done':
      return <span style={{ color: 'var(--state-success)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Pipeline complete</span>;
    case 'awaiting_user_review':
      return <span style={{ display: 'inline-block', color: 'var(--state-warning)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }} className="signal-attention-card" >Awaiting review</span>;
    case 'awaiting_rejection_routing':
      return <span style={{ color: 'var(--state-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>QA rejected — action required</span>;
    case 'awaiting_merge_approval':
      return <span style={{ color: 'var(--state-warning)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Ready for approval</span>;
    case 'parallel-dev':
      return <span style={{ color: 'var(--role-developer)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Parallel development in progress</span>;
    case 'tl-code-review':
      return <span style={{ color: 'var(--role-techlead)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Code review in progress</span>;
    case 'creative-director':
      return <span style={{ color: ROLE_COLORS['creative-director'], fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Creative review in progress</span>;
    case 'design-reviewer':
      return <span style={{ color: ROLE_COLORS['design-reviewer'], fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>Design review in progress</span>;
    default: {
      const displayName = STAGE_DISPLAY[stage];
      if (displayName && stage !== 'idle' && stage !== 'scheduled') {
        return <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{displayName} in progress</span>;
      }
      return null;
    }
  }
}

export const PipelineView: React.FC = () => {
  const session = useStore((s) => s.session);
  const setActiveAgentTab = useStore((s) => s.setActiveAgentTab);
  const currentStage = session?.currentStage || 'idle';
  const pipelineType: PipelineType = session?.pipelineType ?? session?.task?.pipelineType ?? 'development';

  const PIPELINE_STEPS = getPipelineSteps(pipelineType);
  const STAGE_ORDER = getStageOrder(pipelineType);

  const effectiveStage = currentStage === 'parallel-dev' ? 'developer' : currentStage;
  const effectiveIdx = STAGE_ORDER.indexOf(effectiveStage);

  const stageInfo = getStageInfo(currentStage, pipelineType);

  const isAttention = currentStage === 'awaiting_user_review' || currentStage === 'awaiting_merge_approval' || currentStage === 'awaiting_rejection_routing';

  return (
    <div
      style={{
        ...styles.container,
        borderBottom: isAttention
          ? '1px solid var(--state-warning)'
          : '1px solid var(--border-color)',
      }}
      className="pipeline-container"
    >
      <div style={styles.steps}>
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STAGE_ORDER.indexOf(step.stage);
          const isActive = step.stage === effectiveStage
            || (step.stage === (SHARED_PIPELINE_CONFIGS[pipelineType].allStages.slice(-1)[0]?.stage) && currentStage === 'awaiting_rejection_routing');
          const isQaRejected = currentStage === 'awaiting_rejection_routing';
          const isQaStage = step.stage === SHARED_PIPELINE_CONFIGS[pipelineType].allStages.slice(-1)[0]?.stage;
          const isRejected = isQaStage && isQaRejected;

          const isCompleted = effectiveIdx > stepIdx && currentStage !== 'failed';
          const isFailed = currentStage === 'failed';

          const roleColor = ROLE_COLOR[step.role] || step.color;
          const effectiveColor = isRejected ? 'var(--state-error)' : roleColor;

          const dotBg = isCompleted
            ? 'var(--state-success)'
            : isActive
              ? effectiveColor
              : 'var(--bg-tertiary)';

          return (
            <React.Fragment key={step.stage}>
              {i > 0 && (
                <div
                  style={{
                    width: '16px',
                    height: '1px',
                    backgroundColor: isCompleted ? 'var(--border-active)' : 'var(--border-color)',
                    flexShrink: 0,
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isActive ? 'var(--border-input)' : 'transparent'}`,
                  background: isActive ? 'var(--brand-muted)' : 'transparent',
                  opacity: isFailed && !isCompleted && !isActive ? 0.4 : 1,
                  flexShrink: 0,
                  cursor: step.role ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (step.role) {
                    // Map stage names to agent roles (e.g., 'tl-code-review' -> 'tech-lead')
                    const roleMap: Record<string, string> = { 'tl-code-review': 'tech-lead' };
                    const agentRole = roleMap[step.role] ?? step.role;
                    setActiveAgentTab(agentRole as any);
                  }
                }}
              >
                {/* 4px dot */}
                <span
                  className={isActive ? 'signal-glow-pulse' : ''}
                  style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: 'var(--radius-full)',
                    background: dotBg,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
                {/* Phosphor icon for known roles */}
                {ROLE_ICON[step.role] && (
                  <span style={{ color: isActive ? effectiveColor : isCompleted ? 'var(--state-success)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {ROLE_ICON[step.role]}
                  </span>
                )}
                {/* Label */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 'var(--weight-bold)' : 'var(--weight-medium)',
                  color: isActive
                    ? 'var(--text-primary)'
                    : isCompleted
                      ? 'var(--state-success)'
                      : 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {session && (
        <div style={styles.stageInfo}>
          {currentStage === 'failed' && (
            <span style={{ color: 'var(--state-error)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>error: {session.error}</span>
          )}
          {stageInfo}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0 20px',
    backgroundColor: 'var(--bg-secondary)',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    overflowX: 'auto',
    flexShrink: 0,
  },
  steps: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    flex: 1,
  },
  stageInfo: {
    fontSize: 'var(--text-xs)',
    marginLeft: 'auto',
    flexShrink: 0,
  },
};
