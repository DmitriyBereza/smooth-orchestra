import React, { useEffect, useState } from 'react';
import { useProjectStore, ProjectRecord } from '../../store/projectStore';
import { ProjectForm } from './ProjectForm';
import { ProjectList } from './ProjectList';

export const ProjectManager: React.FC = () => {
  const { projects, fetchProjects, loading } = useProjectStore();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectRecord | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleEdit = (project: ProjectRecord) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>projects</h3>
        <button
          style={styles.addButton}
          onClick={() => setShowForm(true)}
        >
          + add project
        </button>
      </div>

      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleFormClose}
        />
      )}

      {loading && projects.length === 0 ? (
        <div style={styles.empty}>loading...</div>
      ) : projects.length === 0 ? (
        <div style={styles.empty}>{'> no projects yet'}</div>
      ) : (
        <ProjectList projects={projects} onEdit={handleEdit} />
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  addButton: {
    padding: '4px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  empty: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    padding: '12px 0',
  },
};
