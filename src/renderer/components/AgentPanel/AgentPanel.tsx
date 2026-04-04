import React, { useMemo, useState } from 'react';
import { AgentRole, ROLE_DISPLAY_NAMES, ROLE_COLORS, useStore, SubtaskState } from '../../store/sessionStore';
import { AgentTab } from './AgentTab';
import { getRolesForPipeline } from '../../../shared/pipeline-configs';
import { Circle, CircleNotch, CheckCircle, XCircle } from '@phosphor-icons/react';
import { ROLE_COLOR, ROLE_GLOW } from '../../utils/roleColors';

function SubtaskStatusIcon({ status }: { status: SubtaskState['status'] }) {
  switch (status) {
    case 'in_progress':
      return <CircleNotch weight="bold" size={12} className="spin" style={{ color: 'var(--role-developer)' }} />;
    case 'completed':
      return <CheckCircle weight="fill" size={12} style={{ color: 'var(--state-success)' }} />;
    case 'failed':
      return <XCircle weight="fill" size={12} style={{ color: 'var(--state-error)' }} />;
    default:
      return <Circle weight="bold" size={12} style={{ color: 'var(--text-muted)' }} />;
  }
}

export const AgentPanel: React.FC = () => {
  const activeTab = useStore((s) => s.activeAgentTab);
  const setActiveTab = useStore((s) => s.setActiveAgentTab);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const session = useStore((s) => s.session);
  const agents = useStore((s) => s.agents);
  const subtasks = useStore((s) => s.subtasks);

  const pipelineType = session?.pipelineType;
  const roles = useMemo(
    () => getRolesForPipeline(pipelineType) as AgentRole[],
    [pipelineType],
  );

  React.useEffect(() => {
    if (!roles.includes(activeTab)) {
      setActiveTab('po');
    }
  }, [roles, activeTab]);

  const isParallelDev = session?.currentStage === 'parallel-dev' && subtasks.length > 0;
  const showSubtaskTabs = isParallelDev && activeTab === 'developer';

  return (
    <div style={styles.container} className="agent-panel-container">
      <div style={styles.tabs} className="agent-panel-tabs">
        {roles.map((role) => {
          const agent = agents.find((a) => a.role === role);
          const isActive = activeTab === role;
          const isRunning = agent?.status === 'running';
          const roleColor = ROLE_COLOR[role] || ROLE_COLORS[role] || 'var(--brand-primary)';

          return (
            <button
              key={role}
              style={{
                ...styles.tab,
                ...(isActive ? {
                  borderBottom: `2px solid ${roleColor}`,
                  color: 'var(--text-primary)',
                  background: 'var(--brand-muted)',
                  boxShadow: `0 2px 8px ${ROLE_GLOW[role] ?? 'transparent'}`,
                } : {
                  borderBottom: '2px solid transparent',
                  color: 'var(--text-muted)',
                  background: 'transparent',
                  boxShadow: 'none',
                }),
              }}
              onClick={() => {
                setActiveTab(role);
                setActiveSubtaskId(null);
              }}
            >
              {isRunning && (
                <span
                  className="signal-running-dot"
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: 'var(--radius-full)',
                    background: roleColor,
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
              )}
              {!isRunning && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: 'var(--radius-full)',
                    background: agent?.status === 'completed'
                      ? 'var(--state-success)'
                      : agent?.status === 'failed'
                        ? 'var(--state-error)'
                        : 'var(--text-muted)',
                    flexShrink: 0,
                    display: 'inline-block',
                  }}
                />
              )}
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
                  borderBottom: isActive ? `2px solid ${ROLE_COLOR.developer}` : '2px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'var(--brand-muted)' : 'transparent',
                }}
                onClick={() => setActiveSubtaskId(st.id)}
                title={st.title}
              >
                <span style={styles.subtaskStatusIcon}>
                  <SubtaskStatusIcon status={st.status} />
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
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    overflowX: 'auto',
    height: '38px',
    alignItems: 'stretch',
  },
  tab: {
    padding: '0 16px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap' as const,
    transition: 'all var(--transition-fast)',
    flexShrink: 0,
  },
  subtaskTabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    paddingLeft: '8px',
    backgroundColor: 'var(--bg-secondary)',
  },
  subtaskTab: {
    padding: '6px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)',
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap' as const,
    transition: 'all var(--transition-fast)',
  },
  subtaskStatusIcon: {
    fontSize: 'var(--text-xs)',
    display: 'flex',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    minHeight: 0,
  },
};
