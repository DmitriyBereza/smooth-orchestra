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

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <span style={styles.item}>
          <span
            className={`status-dot ${connected ? 'completed' : 'failed'}`}
          />
          <span style={styles.orchestraLabel}>Orchestra</span>
        </span>

        {session && (
          <>
            <span style={styles.separator}>|</span>
            <span style={{ ...styles.item, fontFamily: 'var(--font-typewriter)' }}>
              {session.task.id}: {STAGE_DISPLAY[session.currentStage]}
            </span>
            {session.gitBranch && (
              <>
                <span style={styles.separator}>|</span>
                <span style={styles.item}>
                  <GitIcon /> {session.gitBranch}
                </span>
              </>
            )}
          </>
        )}
      </div>

      <div style={styles.right}>
        {runningCount > 0 && (
          <span style={{ ...styles.item, color: '#ffd700' }}>
            {runningCount} agent{runningCount > 1 ? 's' : ''} running
          </span>
        )}
        {totalTokens > 0 && (
          <>
            <span style={styles.separator}>|</span>
            <span style={{ ...styles.item, color: '#ffd700' }}>
              {totalTokens.toLocaleString()} tokens
            </span>
          </>
        )}
      </div>
    </div>
  );
};

const GitIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="#e8dcc8" style={{ verticalAlign: 'middle' }}>
    <path d="M5 3.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm0 2.122a2.25 2.25 0 1 0-1.5 0v.878A2.25 2.25 0 0 0 5.75 8.5h1.5v2.128a2.251 2.251 0 1 0 1.5 0V8.5h1.5a2.25 2.25 0 0 0 2.25-2.25v-.878a2.25 2.25 0 1 0-1.5 0v.878a.75.75 0 0 1-.75.75h-4.5A.75.75 0 0 1 5 6.25v-.878zm3.75 7.378a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0zm3-8.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
  </svg>
);

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '4px 16px',
    backgroundColor: '#0a0a14',
    borderTop: '1px solid rgba(255, 215, 0, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    color: '#e8dcc8',
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  orchestraLabel: {
    fontFamily: 'var(--font-sans)',
    textShadow: '0 0 4px rgba(255, 215, 0, 0.3)',
  },
  separator: {
    color: 'rgba(255, 215, 0, 0.2)',
  },
};
