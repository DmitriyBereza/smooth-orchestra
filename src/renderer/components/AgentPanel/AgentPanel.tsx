import React, { useState } from 'react';
import { AgentRole, ROLE_DISPLAY_NAMES, ROLE_COLORS, useStore } from '../../store/sessionStore';
import { AgentTab } from './AgentTab';

const ROLES: AgentRole[] = ['po', 'architect', 'tech-lead', 'developer', 'qa'];

export const AgentPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AgentRole>('po');
  const session = useStore((s) => s.session);
  const agents = useStore((s) => s.agents);

  // Auto-switch to the active agent's tab
  const currentStageRole = session?.currentStage
    ? ({ po: 'po', architect: 'architect', 'tech-lead': 'tech-lead', developer: 'developer', qa: 'qa' } as Record<string, AgentRole>)[session.currentStage]
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {ROLES.map((role) => {
          const agent = agents.find((a) => a.role === role);
          const isActive = activeTab === role;
          const isRunning = agent?.status === 'running';
          const isCurrent = currentStageRole === role;

          return (
            <button
              key={role}
              style={{
                ...styles.tab,
                borderBottomColor: isActive ? ROLE_COLORS[role] : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'rgba(26, 26, 46, 0.8)' : 'transparent',
              }}
              onClick={() => setActiveTab(role)}
            >
              <span
                className={`status-dot ${isRunning ? 'running' : agent?.status || 'idle'}`}
              />
              <span>{ROLE_DISPLAY_NAMES[role]}</span>
            </button>
          );
        })}
      </div>

      <div style={styles.content}>
        <AgentTab role={activeTab} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
    backgroundColor: '#0a0a14',
    flexShrink: 0,
    overflowX: 'auto',
  },
  tab: {
    padding: '10px 16px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
};
