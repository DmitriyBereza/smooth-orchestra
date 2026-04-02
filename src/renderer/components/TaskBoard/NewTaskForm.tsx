import React, { useState } from 'react';

interface NewTaskFormProps {
  onSubmit: (title: string, description: string) => void;
  disabled?: boolean;
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onSubmit, disabled }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title.trim(), description.trim());
    setTitle('');
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.heading}>New Task</h3>
      <input
        type="text"
        placeholder="Task title..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.input}
        disabled={disabled}
      />
      <textarea
        placeholder="Describe what you want built. Be specific about requirements, expected behavior, and any constraints..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={styles.textarea}
        rows={6}
        disabled={disabled}
      />
      <button
        type="submit"
        style={{
          ...styles.button,
          opacity: disabled || !title.trim() || !description.trim() ? 0.5 : 1,
        }}
        disabled={disabled || !title.trim() || !description.trim()}
      >
        Start Pipeline
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    background: 'rgba(232, 220, 200, 0.03)',
    border: '1px solid rgba(232, 220, 200, 0.08)',
    borderRadius: 8,
    padding: 20,
    transform: 'rotate(-0.3deg)',
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: '#ffd700',
    letterSpacing: '0.05em',
    marginBottom: 4,
  },
  input: {
    padding: '10px 12px',
    backgroundColor: 'rgba(10, 10, 20, 0.6)',
    border: '1px solid rgba(255, 215, 0, 0.15)',
    borderRadius: 6,
    color: '#e8dcc8',
    fontSize: 14,
    fontFamily: 'var(--font-typewriter)',
    outline: 'none',
  },
  textarea: {
    padding: '10px 12px',
    backgroundColor: 'rgba(10, 10, 20, 0.6)',
    border: '1px solid rgba(255, 215, 0, 0.15)',
    borderRadius: 6,
    color: '#e8dcc8',
    fontSize: 13,
    fontFamily: 'var(--font-typewriter)',
    resize: 'vertical' as const,
    outline: 'none',
    lineHeight: 1.5,
  },
  button: {
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
    color: '#050505',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    letterSpacing: '0.05em',
  },
};
