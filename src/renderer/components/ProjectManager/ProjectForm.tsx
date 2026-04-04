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
      <div style={styles.formTitle}>{project ? 'edit project' : 'new project'}</div>

      <input
        type="text"
        placeholder="> project name_"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={styles.input}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-active)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-input)';
        }}
        autoFocus
      />

      <input
        type="text"
        placeholder="> absolute path_"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        style={styles.input}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-active)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-input)';
        }}
      />

      <input
        type="text"
        placeholder="> labels (comma-separated)_"
        value={labelInput}
        onChange={(e) => setLabelInput(e.target.value)}
        style={styles.input}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-active)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-input)';
        }}
      />

      <div style={styles.actions}>
        <button
          type="button"
          onClick={onClose}
          style={styles.cancelButton}
        >
          cancel
        </button>
        <button
          type="submit"
          style={{
            ...styles.saveButton,
            opacity: !name.trim() || !path.trim() || saving ? 0.5 : 1,
          }}
          disabled={!name.trim() || !path.trim() || saving}
        >
          {saving ? 'saving...' : project ? './update' : './add'}
        </button>
      </div>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-input)',
  },
  formTitle: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    marginBottom: '4px',
  },
  input: {
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-input)',
    borderRadius: 0,
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    width: '100%',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
    marginTop: '4px',
  },
  cancelButton: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  saveButton: {
    padding: '6px 12px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
};
