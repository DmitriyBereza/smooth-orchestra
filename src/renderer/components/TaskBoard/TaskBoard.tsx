import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/sessionStore';
import { useProjectStore } from '../../store/projectStore';
import { NewTaskForm } from './NewTaskForm';
import { TaskCard } from './TaskCard';
import { ProjectManager } from '../ProjectManager/ProjectManager';
import { useSocketCommands } from '../../hooks/useSocket';
import { JiraImportPanel, JiraIssue } from './JiraImportPanel';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

export const TaskBoard: React.FC = () => {
  const session = useStore((s) => s.session);
  const connected = useStore((s) => s.connected);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const selectedProjectIds = useProjectStore((s) => s.selectedProjectIds);
  const commands = useSocketCommands();
  const isMobile = useIsMobile();

  const [jiraImport, setJiraImport] = useState<{ title: string; description: string; key: string } | null>(null);

  const handleJiraImport = (issue: JiraIssue) => {
    setJiraImport({ title: issue.summary, description: issue.description, key: issue.key });
  };

  const isTaskInProgress = session && !['done', 'failed', 'idle'].includes(session.currentStage);
  const formDisabled = !connected || !!isTaskInProgress || selectedProjectIds.length === 0;

  return (
    <div style={styles.container} className="task-board-container">
      <div style={styles.header}>
        <h2 style={styles.title}>task board</h2>
        <div style={styles.connectionStatus}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: 'var(--radius-full)',
              background: connected ? 'var(--state-success)' : 'var(--state-error)',
              display: 'inline-block',
              boxShadow: connected ? '0 0 4px var(--state-success)' : 'none',
            }}
          />
          <span style={styles.connectionText}>
            {connected ? 'connected' : 'disconnected'}
          </span>
        </div>
      </div>

      <div style={{
        ...styles.content,
        ...(isMobile ? { paddingBottom: 24 } : {}),
      }}>
        <ProjectManager />

        <div style={styles.divider} />

        {selectedProjectIds.length === 0 && (
          <div style={styles.projectHint}>
            {'> select project to create task'}
          </div>
        )}

        <JiraImportPanel onImport={handleJiraImport} disabled={!connected} />

        <NewTaskForm
          onSubmit={(title, description, scheduledAt, models, jiraIssueKey, createJiraIssue, pipelineType) => {
            commands.createTask(title, description, selectedProjectIds.length > 0 ? selectedProjectIds : undefined, scheduledAt, models, jiraIssueKey, createJiraIssue, pipelineType);
            setJiraImport(null);
          }}
          disabled={formDisabled}
          initialTitle={jiraImport?.title}
          initialDescription={jiraImport?.description}
          initialJiraKey={jiraImport?.key}
        />

        {session && (
          <div style={styles.taskSection}>
            <h3 style={styles.sectionTitle}>current task</h3>
            <TaskCard
              session={session}
              onApprove={(pipeline) => commands.approveSpec(session.id, pipeline)}
              onReject={(feedback) => commands.rejectSpec(session.id, feedback)}
              onAnswerQuestions={(answers) => commands.answerQuestions(session.id, answers)}
              onAbort={() => commands.abortTask(session.id)}
              onRouteRejection={(routing) => commands.routeRejection(session.id, routing)}
              onApproveMerge={() => commands.approveMerge(session.id)}
              onRejectMerge={(feedback) => commands.rejectMerge(session.id, feedback)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    borderRight: '1px solid var(--border-color)',
    width: 360,
    flexShrink: 0,
    maxWidth: '100%',
  },
  header: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  connectionText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  content: {
    padding: '16px',
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  taskSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '4px 0',
  },
  projectHint: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    padding: '8px 0',
  },
};
