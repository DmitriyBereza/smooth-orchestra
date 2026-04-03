import React, { useState } from 'react';
import { useProjectStore, ProjectRecord } from '../../store/projectStore';

interface ProjectFormProps {
  project: ProjectRecord | null; // null = create mode
  onClose: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose }) => {
  const { createProject, updateProject } = useProjectStore();
  const [name, setName] = useState(project?.name ?? '');
  const [path, setPath] = useState(project?.path ?? '');
  const [labelInput, setLabelInput] = useState(project?.labels.join(', ') ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    const labels = labelInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      if (project) {
        await updateProject(project.id, { name: name.trim(), path: path.trim(), labels });
      } else {
        await createProject(name.trim(), path.trim(), labels);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.formTitle}>{project ? 'Edit Project' : 'New Project'}</div>

      <input
        type="text"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={styles.input}
        autoFocus
      />

      <input
        type="text"
        placeholder="Code location (absolute path)"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        style={styles.input}
      />

      <input
        type="text"
        placeholder="Labels (comma-separated, e.g. frontend, react, api)"
        value={labelInput}
        onChange={(e) => setLabelInput(e.target.value)}
        style={styles.input}
      />

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onClose}
          style={styles.cancelButton}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            ...styles.saveButton,
            opacity: !name.trim() || !path.trim() || saving ? 0.5 : 1,
          }}
          disabled={!name.trim() || !path.trim() || saving}
        >
          {saving ? 'Saving...' : project ? 'Update' : 'Add'}
        </button>
      </div>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: 12,
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
  },
  formTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
  },
  input: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  saveButton: {
    padding: '6px 12px',
    backgroundColor: 'var(--accent-blue)',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
