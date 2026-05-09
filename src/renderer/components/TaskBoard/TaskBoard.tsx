import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/sessionStore';
import { useProjectStore } from '../../store/projectStore';
import { useStandbyStore, BacklogItem } from '../../store/standbyStore';
import { NewTaskForm } from './NewTaskForm';
import { TaskCard } from './TaskCard';
import { TaskHistoryCard } from './TaskHistoryCard';
import { ProjectManager } from '../ProjectManager/ProjectManager';
import { StandbyPanel } from '../Standby/StandbyPanel';
import { useSocketCommands } from '../../hooks/useSocket';
import { JiraImportPanel, JiraIssue } from './JiraImportPanel';
import { TelegramSettingsPanel } from './TelegramSettingsPanel';
import { PipelineType } from '../../store/sessionStore';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

const TaskHistory: React.FC = () => {
  const history = useStore((s) => s.sessionHistory);
  if (history.length === 0) return null;

  return (
    <div style={styles.taskSection}>
      <h3 style={styles.sectionTitle}>history ({history.length})</h3>
      {history.map((session) => (
        <TaskHistoryCard key={session.id} session={session} />
      ))}
    </div>
  );
};

interface PendingPromote {
  backlogId: string;
  title: string;
  body: string;
  pipelineType: PipelineType;
  projectId: string;
  projectName?: string;
  /**
   * Set after the user clicks submit. Used to identify the resulting session
   * so we can call markPromoted exactly once with the new task ID.
   */
  awaitingSinceMs: number | null;
}

export const TaskBoard: React.FC = () => {
  const session = useStore((s) => s.session);
  const connected = useStore((s) => s.connected);
  const selectedProjectIds = useProjectStore((s) => s.selectedProjectIds);
  const setSelectedProject = useProjectStore((s) => s.toggleProject);
  const projects = useProjectStore((s) => s.projects);
  const markPromoted = useStandbyStore((s) => s.markPromoted);
  const commands = useSocketCommands();
  const isMobile = useIsMobile();

  const [jiraImport, setJiraImport] = useState<{ title: string; description: string; key: string } | null>(null);
  const [pendingPromote, setPendingPromote] = useState<PendingPromote | null>(null);
  const [focusModelsToken, setFocusModelsToken] = useState(0);
  const lastSeenSessionId = useRef<string | null>(session?.id ?? null);

  /**
   * Start the promote-to-pipeline flow: pre-fill the New Task form with the
   * proposal, switch the project selection to the source project, and bump
   * focusModelsToken so the form auto-expands and scrolls to the model picker.
   */
  const startPromote = (item: BacklogItem, pipelineType: PipelineType) => {
    if (!item.projectId) {
      console.warn('[TaskBoard] cannot promote: backlog item has no projectId', item);
      return;
    }
    // Replace project selection with just the source project so the form fires against the right one.
    if (!selectedProjectIds.includes(item.projectId) || selectedProjectIds.length !== 1) {
      // Clear current selection and add only this project
      for (const id of selectedProjectIds) {
        if (id !== item.projectId) setSelectedProject(id); // toggle off
      }
      if (!selectedProjectIds.includes(item.projectId)) {
        setSelectedProject(item.projectId); // toggle on
      }
    }
    setJiraImport(null);
    setPendingPromote({
      backlogId: item.id,
      title: item.title,
      body: item.body,
      pipelineType,
      projectId: item.projectId,
      projectName: item.projectName ?? projects.find((p) => p.id === item.projectId)?.name,
      awaitingSinceMs: null,
    });
    setFocusModelsToken((t) => t + 1);
  };

  // After a task is successfully created from a pendingPromote submission,
  // stamp the backlog item as promoted with the new task ID.
  useEffect(() => {
    if (!pendingPromote?.awaitingSinceMs) return;
    if (!session?.task?.id || !session?.startedAt) return;
    const startedAtMs = new Date(session.startedAt).getTime();
    if (Number.isNaN(startedAtMs)) return;
    if (startedAtMs < pendingPromote.awaitingSinceMs) return;
    if (session.id === lastSeenSessionId.current) return;
    lastSeenSessionId.current = session.id;
    const taskId = session.task.id;
    const backlogId = pendingPromote.backlogId;
    setPendingPromote(null);
    markPromoted(backlogId, taskId).catch((err) =>
      console.warn('[TaskBoard] markPromoted failed:', err.message),
    );
  }, [session, pendingPromote, markPromoted]);

  const handleJiraImport = (issue: JiraIssue) => {
    setJiraImport({ title: issue.summary, description: issue.description, key: issue.key });
    setPendingPromote(null); // jira import overrides any pending promote
  };

  const isTaskInProgress = session && !['done', 'failed', 'idle'].includes(session.currentStage);
  const formDisabled = !connected || !!isTaskInProgress || selectedProjectIds.length === 0;

  // Banner shown above the form when promoting from a backlog item.
  const promoteBanner = pendingPromote
    ? {
        text: `Promoting "${pendingPromote.title}"${pendingPromote.projectName ? ` for ${pendingPromote.projectName}` : ''} — confirm models below, then ./run pipeline.`,
        tone: 'info' as const,
      }
    : null;

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

        <TelegramSettingsPanel />

        <NewTaskForm
          onSubmit={(title, description, scheduledAt, models, jiraIssueKey, createJiraIssue, pipelineType, autoApproveSpec) => {
            commands.createTask(title, description, selectedProjectIds.length > 0 ? selectedProjectIds : undefined, scheduledAt, models, jiraIssueKey, createJiraIssue, pipelineType, autoApproveSpec);
            setJiraImport(null);
            // If this submission came from a promote-to-pipeline flow, mark the
            // pending entry as awaiting the resulting session so we can stamp
            // the backlog item once the new task lands.
            if (pendingPromote) {
              setPendingPromote((p) => (p ? { ...p, awaitingSinceMs: Date.now() } : null));
            }
          }}
          disabled={formDisabled}
          initialTitle={pendingPromote?.title ?? jiraImport?.title}
          initialDescription={pendingPromote?.body ?? jiraImport?.description}
          initialJiraKey={jiraImport?.key}
          initialPipelineType={pendingPromote?.pipelineType}
          focusModelsToken={focusModelsToken}
          banner={promoteBanner}
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
              onApproveMerge={(skipMerge) => commands.approveMerge(session.id, skipMerge)}
              onRejectMerge={(feedback) => commands.rejectMerge(session.id, feedback)}
            />
          </div>
        )}

        <div style={styles.divider} />
        <StandbyPanel onStartPromote={startPromote} taskInProgress={!!isTaskInProgress} />

        <TaskHistory />
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
