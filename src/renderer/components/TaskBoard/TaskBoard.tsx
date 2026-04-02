import React from 'react';
import { useStore } from '../../store/sessionStore';
import { NewTaskForm } from './NewTaskForm';
import { TaskCard } from './TaskCard';
import { useSocketCommands } from '../../hooks/useSocket';

export const TaskBoard: React.FC = () => {
  const session = useStore((s) => s.session);
  const connected = useStore((s) => s.connected);
  const commands = useSocketCommands();

  const isTaskInProgress = session && !['done', 'failed', 'idle'].includes(session.currentStage);

  return (
    <div style={styles.container}>
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

      <div style={styles.content}>
        <NewTaskForm
          onSubmit={(title, description) => commands.createTask(title, description)}
          disabled={!connected || !!isTaskInProgress}
        />

        {session && (
          <div style={styles.taskSection}>
            <h3 style={styles.sectionTitle}>Current Task</h3>
            <TaskCard
              session={session}
              onApprove={() => commands.approveSpec(session.id)}
              onReject={(feedback) => commands.rejectSpec(session.id, feedback)}
              onAbort={() => commands.abortTask(session.id)}
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
    height: '100%',
    borderRight: '1px solid var(--border-color)',
    width: 360,
    flexShrink: 0,
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
};
