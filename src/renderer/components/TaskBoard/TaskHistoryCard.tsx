import React, { useState, useEffect } from 'react';
import { SessionState, STAGE_DISPLAY, PipelineType } from '../../store/sessionStore';

interface TaskHistoryCardProps {
  session: SessionState;
}

interface ArtifactMeta {
  type: string;
  filename: string;
  path: string;
  createdAt: string;
  stage: string;
}

export const TaskHistoryCard: React.FC<TaskHistoryCardProps> = ({ session }) => {
  const [expanded, setExpanded] = useState(false);
  const [artifacts, setArtifacts] = useState<ArtifactMeta[]>([]);

  const isDone = session.currentStage === 'done';
  const isFailed = session.currentStage === 'failed';
  const pipelineType: PipelineType = session.pipelineType ?? session.task?.pipelineType ?? 'development';

  useEffect(() => {
    if (expanded && artifacts.length === 0) {
      fetch(`/api/artifacts/${encodeURIComponent(session.task.id)}`)
        .then((res) => res.ok ? res.json() : [])
        .then((data) => setArtifacts(data))
        .catch(() => {});
    }
  }, [expanded, session.task.id]);

  const elapsed = session.completedAt && session.startedAt
    ? formatDuration(new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime())
    : null;

  return (
    <div
      style={{
        ...styles.card,
        borderLeft: `3px solid ${isDone ? 'var(--state-success)' : isFailed ? 'var(--state-error)' : 'var(--text-muted)'}`,
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={styles.header}>
        <span style={styles.taskId}>{session.task.id}</span>
        {session.jiraIssueKey && (
          <span style={styles.jiraBadge}>{session.jiraIssueKey}</span>
        )}
        <span style={{
          ...styles.badge,
          color: isDone ? 'var(--state-success)' : isFailed ? 'var(--state-error)' : 'var(--text-muted)',
        }}>
          {STAGE_DISPLAY[session.currentStage] ?? session.currentStage}
        </span>
      </div>

      <div style={styles.title}>{session.task.title}</div>

      <div style={styles.meta}>
        {pipelineType !== 'development' && (
          <span style={styles.metaItem}>{pipelineType}</span>
        )}
        {elapsed && <span style={styles.metaItem}>{elapsed}</span>}
        {session.completedAt && (
          <span style={styles.metaItem}>
            {new Date(session.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      {expanded && (
        <div style={styles.details}>
          {session.gitBranch && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>branch:</span>
              <span style={styles.detailValue}>{session.gitBranch}</span>
            </div>
          )}

          {session.jiraIssueKey && (
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>jira:</span>
              <span style={styles.detailValue}>{session.jiraIssueKey}</span>
            </div>
          )}

          {artifacts.length > 0 ? (
            <div style={styles.artifactSection}>
              <span style={styles.detailLabel}>artifacts:</span>
              {artifacts.map((a) => (
                <div key={a.type} style={styles.artifactRow}>
                  <span style={styles.artifactName}>{a.filename}</span>
                  <span style={styles.artifactSize}>{a.stage}</span>
                </div>
              ))}
            </div>
          ) : Object.keys(session.artifacts).length > 0 && (
            <div style={styles.artifactSection}>
              <span style={styles.detailLabel}>artifacts:</span>
              {Object.entries(session.artifacts).map(([name, filepath]) => (
                <div key={name} style={styles.artifactRow}>
                  <span style={styles.artifactName}>{name}</span>
                  <span style={styles.artifactSize}>{(filepath as string).split('/').pop()}</span>
                </div>
              ))}
            </div>
          )}

          {session.error && (
            <div style={styles.detailRow}>
              <span style={{ ...styles.detailValue, color: 'var(--state-error)' }}>
                error: {session.error}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainMinutes = minutes % 60;
  return `${hours}h ${remainMinutes}m`;
}


const styles: Record<string, React.CSSProperties> = {
  card: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  taskId: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--text-code)',
  },
  jiraBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    padding: '1px 4px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--jira-badge-bg)',
    color: 'var(--jira-badge-color)',
    border: '1px solid var(--jira-badge-border)',
  },
  badge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginLeft: 'auto',
  },
  title: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
  },
  meta: {
    display: 'flex',
    gap: '8px',
  },
  metaItem: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  details: {
    marginTop: '6px',
    paddingTop: '6px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  detailRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'baseline',
  },
  detailLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    wordBreak: 'break-all' as const,
  },
  artifactSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  artifactRow: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingLeft: '8px',
  },
  artifactName: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
  },
  artifactSize: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
};
