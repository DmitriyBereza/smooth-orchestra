import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

export const LoginPage: React.FC = () => {
  const { login, error, loading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    await login(email.trim(), password);
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1 style={styles.title}>Smooth Orchestra</h1>
        <p style={styles.subtitle}>AI Dev Team</p>

        {error && <div style={styles.error}>{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          autoFocus
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
        />

        <button
          type="submit"
          style={{
            ...styles.button,
            opacity: loading || !email.trim() || !password ? 0.5 : 1,
          }}
          disabled={loading || !email.trim() || !password}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 320,
    padding: 32,
    margin: '0 16px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 8,
    border: '1px solid var(--border-color)',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary)',
    textAlign: 'center',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--text-muted)',
    textAlign: 'center',
    margin: '-8px 0 8px',
  },
  error: {
    padding: '8px 12px',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-red)',
    borderRadius: 4,
    fontSize: 13,
  },
  input: {
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  button: {
    padding: '10px 16px',
    backgroundColor: 'var(--accent-blue)',
    color: 'white',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    marginTop: 4,
  },
};
