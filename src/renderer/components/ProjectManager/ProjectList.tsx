import React from 'react';
import { useProjectStore, ProjectRecord } from '../../store/projectStore';

interface ProjectListProps {
  projects: ProjectRecord[];
  onEdit: (project: ProjectRecord) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onEdit }) => {
  const { selectedProjectIds, selectedProjectId, toggleProject, deleteProject } = useProjectStore();

  return (
    <div style={styles.list}>
      {projects.map((project) => {
        const isSelected = selectedProjectIds.includes(project.id);
        const isPrimary = selectedProjectId === project.id;
        return (
          <div
            key={project.id}
            style={{
              ...styles.card,
              borderColor: isSelected ? 'var(--accent-blue)' : 'var(--border-color)',
            }}
            onClick={() => toggleProject(project.id)}
          >
            <div style={styles.cardHeader}>
              <span style={styles.projectName}>{project.name}</span>
              <div style={styles.cardActions}>
                <button
                  style={styles.iconButton}
                  onClick={(e) => { e.stopPropagation(); onEdit(project); }}
                  title="Edit"
                >
                  Edit
                </button>
                <button
                  style={{ ...styles.iconButton, color: 'var(--accent-red)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${project.name}"?`)) {
                      deleteProject(project.id);
                    }
                  }}
                  title="Delete"
                >
                  Del
                </button>
              </div>
            </div>

            <div style={styles.path}>{project.path}</div>

            {project.labels.length > 0 && (
              <div style={styles.labels}>
                {project.labels.map((label) => (
                  <span key={label} style={styles.label}>
                    {label}
                  </span>
                ))}
              </div>
            )}

            {isSelected && (
              <div style={{
                ...styles.selectedBadge,
                color: isPrimary ? 'var(--accent-blue)' : 'var(--accent-green)',
              }}>
                {isPrimary ? 'Primary (CWD)' : 'Included'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  card: {
    padding: 10,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectName: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  cardActions: {
    display: 'flex',
    gap: 6,
  },
  iconButton: {
    padding: '2px 6px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    borderRadius: 3,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  path: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  labels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  label: {
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: 10,
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
  },
  selectedBadge: {
    marginTop: 6,
    fontSize: 11,
    color: 'var(--accent-blue)',
    fontWeight: 600,
  },
};
