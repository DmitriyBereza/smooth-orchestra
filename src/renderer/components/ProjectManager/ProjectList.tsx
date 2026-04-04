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
              borderColor: isSelected ? 'var(--border-active)' : 'var(--border-input)',
              backgroundColor: isSelected ? 'var(--brand-muted)' : 'var(--bg-secondary)',
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
                  edit
                </button>
                <button
                  style={{ ...styles.iconButton, color: 'var(--state-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${project.name}"?`)) {
                      deleteProject(project.id);
                    }
                  }}
                  title="Delete"
                >
                  del
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
                color: isPrimary ? 'var(--brand-primary)' : 'var(--state-success)',
              }}>
                {isPrimary ? 'primary (cwd)' : 'included'}
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
    gap: '8px',
  },
  card: {
    padding: '10px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'border-color var(--transition-fast)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  projectName: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-body)',
    color: 'var(--text-primary)',
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
  },
  iconButton: {
    padding: '2px 6px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  path: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  labels: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    marginTop: '6px',
  },
  label: {
    padding: '2px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
  },
  selectedBadge: {
    marginTop: '6px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
  },
};
