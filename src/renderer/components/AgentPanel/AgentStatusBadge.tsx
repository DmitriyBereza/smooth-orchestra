import React from 'react';
import { AgentStatus } from '../../store/sessionStore';

interface AgentStatusBadgeProps {
  status: AgentStatus;
}

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  killed: 'Killed',
};

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ status }) => {
  return (
    <div style={styles.container}>
      <span className={`status-dot ${status}`} />
      <span style={styles.label}>{STATUS_LABELS[status]}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontFamily: 'var(--font-typewriter)',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
};
