import React from 'react';
import { useStore, PipelineStage } from '../../store/sessionStore';

/* ── Setlist steps (noir palette) ───────────────────────────── */
const SETLIST_STEPS: { stage: PipelineStage; label: string; color: string }[] = [
  { stage: 'po',                    label: 'Overture',        color: '#ffd700' },
  { stage: 'awaiting_user_review',  label: 'Review',          color: '#ffd700' },
  { stage: 'architect',             label: 'Arrangement',     color: '#9b59b6' },
  { stage: 'tech-lead',             label: 'Lead Solo',       color: '#ff4500' },
  { stage: 'developer',             label: 'Rhythm Section',  color: '#ffd700' },
  { stage: 'qa',                    label: 'Sound Check',     color: '#e8dcc8' },
  { stage: 'done',                  label: 'Encore',          color: '#ffd700' },
];

const STAGE_ORDER = [
  'idle', 'po', 'awaiting_user_review', 'architect',
  'tech-lead', 'developer', 'qa', 'done',
];

/* ── Helpers (logic unchanged) ──────────────────────────────── */

function resolveStageIndex(stage: PipelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function getStatusMessage(stage: PipelineStage, error: string | null): string {
  if (stage === 'idle')                  return 'Waiting in the wings';
  if (stage === 'failed')                return `Off-key: ${error ?? 'unknown'}`;
  if (stage === 'rejected')              return 'Encore denied';
  if (stage === 'done')                  return 'Standing ovation';
  if (stage === 'awaiting_user_review')  return 'Awaiting your review';
  return 'Now playing\u2026';
}

function getStatusColor(stage: PipelineStage): string {
  if (stage === 'idle')                  return '#5c5470';
  if (stage === 'failed')               return '#ff4500';
  if (stage === 'rejected')             return '#ff4500';
  if (stage === 'done')                 return '#ffd700';
  if (stage === 'awaiting_user_review') return '#ffd700';
  return '#e8dcc8';
}

function needsPulse(stage: PipelineStage): boolean {
  return stage !== 'idle' && stage !== 'done' && stage !== 'failed' && stage !== 'rejected';
}

/* ── Component ──────────────────────────────────────────────── */

export const SetlistBar: React.FC = () => {
  const session  = useStore((s) => s.session);
  const currentStage: PipelineStage = session?.currentStage || 'idle';
  const currentIdx = resolveStageIndex(currentStage);
  const isLive = needsPulse(currentStage);

  const statusMsg   = getStatusMessage(currentStage, session?.error ?? null);
  const statusColor = getStatusColor(currentStage);

  return (
    <div style={styles.container}>
      {/* ON AIR label */}
      <span
        className={isLive ? 'neon-flicker' : undefined}
        style={{
          ...styles.onAir,
          textShadow: isLive
            ? '0 0 8px #ff4500, 0 0 16px #ff4500'
            : 'none',
        }}
      >
        ON AIR
      </span>

      {/* Bulb strip */}
      <div style={styles.bulbStrip}>
        {SETLIST_STEPS.map((step, i) => {
          const stepIdx     = resolveStageIndex(step.stage);
          const isActive    = step.stage === currentStage;
          const isCompleted = currentIdx > stepIdx && currentStage !== 'failed';
          const isFailed    = currentStage === 'failed' && step.stage === currentStage;

          /* Bulb appearance */
          let bulbBg: string;
          let bulbShadow: string;
          let bulbBorder: string | undefined;
          let bulbClass: string | undefined;

          if (isFailed) {
            bulbBg     = '#ff4500';
            bulbShadow = '0 0 8px 2px #ff4500, 0 0 16px 4px #ff4500';
          } else if (isActive) {
            bulbBg     = step.color;
            bulbShadow = `0 0 8px 2px ${step.color}, 0 0 16px 4px ${step.color}`;
            bulbClass  = 'bulb-glow';
          } else if (isCompleted) {
            bulbBg     = step.color;
            bulbShadow = 'none';
          } else {
            bulbBg     = '#1a1a2e';
            bulbShadow = 'none';
            bulbBorder = '1px solid #2a2a4a';
          }

          /* Label color */
          const labelColor = isActive
            ? step.color
            : isCompleted
              ? '#a0937d'
              : '#5c5470';

          return (
            <React.Fragment key={step.stage}>
              {/* Wire connector */}
              {i > 0 && <div style={styles.wire} />}

              {/* Bulb + label column */}
              <div style={styles.bulbColumn}>
                <div
                  className={bulbClass}
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: bulbBg,
                    boxShadow: bulbShadow,
                    border: bulbBorder,
                    opacity: isCompleted && !isActive ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    ...styles.stepLabel,
                    color: labelColor,
                  }}
                >
                  {step.label}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Status message */}
      <span
        style={{
          ...styles.statusMsg,
          color: statusColor,
          textShadow: `0 0 6px ${statusColor}44`,
        }}
      >
        {statusMsg}
      </span>
    </div>
  );
};

/* ── Styles ─────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    backgroundColor: '#0a0a14',
    borderTop: '1px solid rgba(255, 215, 0, 0.08)',
    padding: '8px 20px',
  },
  onAir: {
    fontFamily: 'var(--font-typewriter)',
    fontSize: 13,
    fontWeight: 700,
    color: '#ff4500',
    letterSpacing: '0.12em',
    flexShrink: 0,
  },
  bulbStrip: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
  },
  wire: {
    width: 16,
    height: 1,
    backgroundColor: '#2a2a4a',
    flexShrink: 0,
  },
  bulbColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  stepLabel: {
    fontFamily: 'var(--font-typewriter)',
    fontSize: 9,
    textAlign: 'center' as const,
    lineHeight: 1.2,
    maxWidth: 56,
  },
  statusMsg: {
    fontFamily: 'var(--font-typewriter)',
    fontSize: 11,
    flexShrink: 0,
    marginLeft: 'auto',
    whiteSpace: 'nowrap' as const,
  },
};
