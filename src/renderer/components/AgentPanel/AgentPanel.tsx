import React, { useState, useEffect } from 'react';
import { AgentRole, ROLE_DISPLAY_NAMES, ROLE_COLORS, useStore, SubtaskState } from '../../store/sessionStore';
import { AgentTab } from './AgentTab';

const ROLES: AgentRole[] = ['po', 'architect', 'tech-lead', 'developer', 'qa'];

const SUBTASK_STATUS_ICON: Record<SubtaskState['status'], string> = {
  pending: '-',
  in_progress: '*',
  completed: '+',
  failed: 'x',
};

export const AgentPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AgentRole>('po');
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const session = useStore((s) => s.session);
  const agents = useStore((s) => s.agents);
  const subtasks = useStore((s) => s.subtasks);
  const selectedAgent = useStore((s) => s.selectedAgent);
  const setSelectedAgent = useStore((s) => s.setSelectedAgent);

  // When a band member is clicked on the stage, switch to their tab
  useEffect(() => {
    if (selectedAgent) {
      setActiveTab(selectedAgent);
      setActiveSubtaskId(null);
      setSelectedAgent(null);
    }
  }, [selectedAgent, setSelectedAgent]);

  const isParallelDev = session?.currentStage === 'parallel-dev' && subtasks.length > 0;
  const showSubtaskTabs = isParallelDev && activeTab === 'developer';

  return (
    <div style={styles.container}>
      <div style={styles.tabs}>
        {ROLES.map((role) => {
          const agent = agents.find((a) => a.role === role);
          const isActive = activeTab === role;
          const isRunning = agent?.status === 'running';

          return (
            <button
              key={role}
              style={{
                ...styles.tab,
                borderBottomColor: isActive ? ROLE_COLORS[role] : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'rgba(26, 26, 46, 0.8)' : 'transparent',
              }}
              onClick={() => {
                setActiveTab(role);
                setActiveSubtaskId(null);
              }}
            >
              <span
                className={`status-dot ${isRunning ? 'running' : agent?.status || 'idle'}`}
              />
              <span>{ROLE_DISPLAY_NAMES[role]}</span>
            </button>
          );
        })}
      </div>

      {showSubtaskTabs && (
        <div style={styles.subtaskTabs}>
          {subtasks.map((st) => {
            const isActive = activeSubtaskId === st.id;
            return (
              <button
                key={st.id}
                style={{
                  ...styles.subtaskTab,
                  borderBottomColor: isActive ? ROLE_COLORS.developer : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                }}
                onClick={() => setActiveSubtaskId(st.id)}
                title={st.title}
              >
                <span style={styles.subtaskStatusIcon}>
                  [{SUBTASK_STATUS_ICON[st.status]}]
                </span>
                <span>Dev {st.index}</span>
              </button>
            );
          })}
        </div>
      )}

      <div style={styles.content}>
        <AgentTab
          role={activeTab}
          subtaskId={showSubtaskTabs ? activeSubtaskId ?? undefined : undefined}
          agentId={
            showSubtaskTabs && activeSubtaskId
              ? subtasks.find((s) => s.id === activeSubtaskId)?.assignedAgentId ?? undefined
              : undefined
          }
        />
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
  subtaskTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    paddingLeft: 8,
    backgroundColor: 'var(--bg-secondary)',
  },
  subtaskTab: {
    padding: '6px 12px',
    border: 'none',
    borderBottom: '2px solid transparent',
    background: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap' as const,
    transition: 'all 0.15s ease',
  },
  subtaskStatusIcon: {
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    opacity: 0.7,
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
};
