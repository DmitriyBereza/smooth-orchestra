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
      <form onSubmit={handleSubmit} style={styles.stack}>
        {/* Wordmark */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-sm)',
              color: 'var(--brand-primary)',
              fontWeight: 'var(--weight-bold)',
              letterSpacing: '0.1em',
            }}>
              {'//> '}
            </span>
          </div>
          <div>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-regular)',
              color: 'var(--text-secondary)',
            }}>smooth </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--text-2xl)',
              fontWeight: 'var(--weight-bold)',
              color: 'var(--brand-primary)',
            }}>orchestra</span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '6px',
          }}>run AI dev pipelines</div>
        </div>

        {/* Card */}
        <div style={styles.card}>
          <input
            type="email"
            placeholder="> email_"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = 'var(--border-active)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-cyan)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = 'var(--border-input)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            autoFocus
          />

          <input
            type="password"
            placeholder="> password_"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = 'var(--border-active)';
              e.currentTarget.style.boxShadow = 'var(--shadow-glow-cyan)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = 'var(--border-input)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />

          <button
            type="submit"
            aria-label="Sign in"
            style={{
              ...styles.button,
              opacity: loading || !email.trim() || !password ? 0.5 : 1,
            }}
            disabled={loading || !email.trim() || !password}
          >
            {loading ? 'running...' : './run --auth'}
          </button>
        </div>

        {/* Error — below card, no background box */}
        {error && (
          <div style={styles.error}>
            error: {error.toLowerCase()}
          </div>
        )}
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
  stack: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    width: '100%',
    maxWidth: '360px',
    padding: '0 16px',
  },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-active)',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    width: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  input: {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-input)',
    borderRadius: 0,
    padding: '8px 0',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-base)',
    width: '100%',
    outline: 'none',
  },
  button: {
    background: 'var(--brand-primary)',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-md)',
    fontWeight: 'var(--weight-semibold)',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    padding: '10px 16px',
    cursor: 'pointer',
    width: '100%',
    marginTop: '8px',
  },
  error: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--state-error)',
    textAlign: 'center',
  },
};
