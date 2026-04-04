import React from 'react';
import { useStore, STAGE_DISPLAY } from '../../store/sessionStore';

export const StatusBar: React.FC = () => {
  const session = useStore((s) => s.session);
  const connected = useStore((s) => s.connected);
  const agents = useStore((s) => s.agents);

  const runningCount = agents.filter((a) => a.status === 'running').length;
  const totalTokens = agents.reduce(
    (sum, a) => sum + a.tokensUsed.input + a.tokensUsed.output,
    0,
  );

  // Needs attention if review or merge approval required
  const needsAttention = session && (
    session.currentStage === 'awaiting_user_review' ||
    session.currentStage === 'awaiting_merge_approval' ||
    session.currentStage === 'awaiting_rejection_routing'
  );

  const textColor = needsAttention ? 'var(--status-bar-attention)' : 'var(--status-bar-text)';

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        {/* Logotype collapses to ">_" in status bar */}
        <span style={{ color: 'var(--status-bar-accent)', fontWeight: 'var(--weight-bold)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
          {'>_'}
        </span>

        <span style={{ ...styles.separator }}>|</span>

        <span style={{ ...styles.item, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: 'var(--radius-full)',
              background: connected ? 'var(--status-bar-accent)' : 'var(--state-error)',
              display: 'inline-block',
              boxShadow: connected ? 'var(--shadow-glow-cyan)' : 'none',
              flexShrink: 0,
            }}
          />
          <span style={{ color: textColor }}>
            {connected ? 'connected' : 'disconnected'}
          </span>
        </span>

        {session && (
          <>
            <span style={styles.separator}>|</span>
            <span style={{ ...styles.item, color: textColor }}>
              {session.task.id}: {STAGE_DISPLAY[session.currentStage]}
            </span>
            {session.gitBranch && (
              <>
                <span style={styles.separator}>|</span>
                <span style={{ ...styles.item, color: textColor }}>
                  <GitIcon /> {session.gitBranch}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div style={styles.right}>
        {runningCount > 0 && (
          <span style={{ ...styles.item, color: textColor }}>
            {runningCount} agent{runningCount > 1 ? 's' : ''} running
          </span>
        )}
        {totalTokens > 0 && (
          <>
            <span style={styles.separator}>|</span>
            <span style={{ ...styles.item, color: 'var(--status-bar-text)' }}>
              {totalTokens.toLocaleString()} tokens
            </span>
          </>
        )}
      </div>
    </div>
  );
};

const GitIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style={{ verticalAlign: 'middle' }}>
    <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
  </svg>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '0 12px',
    backgroundColor: 'var(--status-bar-bg)',
    height: '26px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--status-bar-text)',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  separator: {
    color: 'var(--border-color)',
  },
};
