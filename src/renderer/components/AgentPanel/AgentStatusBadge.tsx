import React from 'react';
import { AgentStatus } from '../../store/sessionStore';

interface AgentStatusBadgeProps {
  status: AgentStatus;
  role?: string;
}

const ROLE_COLOR: Record<string, string> = {
  po:          'var(--role-po)',
  architect:   'var(--role-architect)',
  developer:   'var(--role-developer)',
  'tech-lead': 'var(--role-techlead)',
  techlead:    'var(--role-techlead)',
  qa:          'var(--role-qa)',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'idle',
  running: 'running',
  completed: 'done',
  failed: 'failed',
  killed: 'killed',
};

export const AgentStatusBadge: React.FC<AgentStatusBadgeProps> = ({ status, role }) => {
  const roleColor = role ? (ROLE_COLOR[role] || 'var(--brand-primary)') : 'var(--brand-primary)';

  const dotBg =
    status === 'running'   ? roleColor :
    status === 'completed' ? 'var(--state-success)' :
    status === 'failed'    ? 'var(--state-error)' :
    status === 'killed'    ? 'var(--state-warning)' :
    'var(--text-muted)';

  return (
    <div style={styles.container}>
      <span
        className={status === 'running' ? 'signal-running-dot' : ''}
        style={{
          width: '8px',
          height: '8px',
          borderRadius: 'var(--radius-full)',
          background: dotBg,
          display: 'inline-block',
          flexShrink: 0,
        }}
      />
      <span style={styles.label}>{STATUS_LABELS[status]}</span>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  label: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-medium)',
    color: 'var(--text-muted)',
  },
};
