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

  // Jira import state — populated when user clicks "Use" on an issue
  const [jiraImport, setJiraImport] = useState<{ title: string; description: string; key: string } | null>(null);

  const handleJiraImport = (issue: JiraIssue) => {
    setJiraImport({ title: issue.summary, description: issue.description, key: issue.key });
  };

  const isTaskInProgress = session && !['done', 'failed', 'idle'].includes(session.currentStage);
  const formDisabled = !connected || !!isTaskInProgress || selectedProjectIds.length === 0;

  return (
    <div style={styles.container} className="task-board-container">
      <div style={styles.header}>
        <h2 style={styles.title}>Task Board</h2>
        <div style={styles.connectionStatus}>
          <span
            className={`status-dot ${connected ? 'completed' : 'failed'}`}
          />
          <span style={styles.connectionText}>
            {connected ? 'Connected' : 'Disconnected'}
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
            Select one or more projects above before creating a task
          </div>
        )}

        <JiraImportPanel onImport={handleJiraImport} disabled={!connected} />

        <NewTaskForm
          onSubmit={(title, description, scheduledAt, models, jiraIssueKey, createJiraIssue) => {
            commands.createTask(title, description, selectedProjectIds.length > 0 ? selectedProjectIds : undefined, scheduledAt, models, jiraIssueKey, createJiraIssue);
            setJiraImport(null);
          }}
          disabled={formDisabled}
          initialTitle={jiraImport?.title}
          initialDescription={jiraImport?.description}
          initialJiraKey={jiraImport?.key}
        />

        {session && (
          <div style={styles.taskSection}>
            <h3 style={styles.sectionTitle}>Current Task</h3>
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
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  connectionText: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  content: {
    padding: 16,
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  taskSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--border-color)',
    margin: '4px 0',
  },
  projectHint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px 0',
  },
};
