import React, { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';

const API_BASE = `${window.location.protocol}//${window.location.hostname}:3333`;

async function apiFetch(path: string, token: string | null, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export const TelegramSettingsPanel: React.FC = () => {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const [showConfig, setShowConfig] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiFetch('/api/telegram/config', token);
      setConfigured(data.configured);
      if (data.config) {
        setChatId(data.config.chatId ?? '');
      }
      if (!data.configured) {
        setShowConfig(true);
      }
    } catch {
      // ignore
    }
  }, [token]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && configured === null) {
      loadConfig();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/telegram/config', token, {
        method: 'POST',
        body: JSON.stringify({ botToken: botToken.trim(), chatId: chatId.trim() }),
      });
      setConfigured(true);
      setShowConfig(false);
      setSuccess('saved');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch('/api/telegram/test', token, { method: 'POST' });
      setSuccess('test message sent — check your telegram');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={styles.container}>
      <button type="button" style={styles.toggle} onClick={handleToggle}>
        <span style={styles.toggleIcon}>✈</span>
        <span style={styles.toggleLabel}>telegram notifications</span>
        <span style={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={styles.panel}>
          {showConfig && (
            <form onSubmit={handleSave} style={styles.configForm}>
              <p style={styles.configHint}>{'> connect telegram bot to receive notifications'}</p>
              <input
                style={styles.input}
                type="password"
                placeholder="> bot token (from @BotFather)_"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                required
              />
              <input
                style={styles.input}
                placeholder="> chat id (user or group)_"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                required
              />
              {error && <p style={styles.errorText}>error: {error}</p>}
              {success && <p style={styles.successText}>{success}</p>}
              <div style={styles.configActions}>
                <button type="submit" style={styles.saveBtn} disabled={saving}>
                  {saving ? 'saving...' : './save --connect'}
                </button>
                {configured && (
                  <button type="button" style={styles.cancelBtn} onClick={() => setShowConfig(false)}>
                    cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {!showConfig && (
            <>
              <div style={styles.listHeader}>
                <span style={styles.listHint}>
                  {configured ? 'connected — notifications active' : 'not configured'}
                </span>
                <div style={styles.listActions}>
                  {configured && (
                    <button type="button" style={styles.iconBtn} onClick={handleTest} disabled={testing} title="Send test message">
                      {testing ? '...' : '▶'}
                    </button>
                  )}
                  <button type="button" style={styles.iconBtn} onClick={() => setShowConfig(true)} title="Settings">
                    ⚙
                  </button>
                </div>
              </div>
              {error && <p style={styles.errorText}>error: {error}</p>}
              {success && <p style={styles.successText}>{success}</p>}
              {configured && (
                <div style={styles.infoBox}>
                  <p style={styles.infoText}>notifications sent when:</p>
                  <p style={styles.infoItem}>📋 PO spec is ready for review</p>
                  <p style={styles.infoItem}>✅ QA passed — ready to merge</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    textAlign: 'left',
  },
  toggleIcon: {
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    flex: 1,
  },
  chevron: {
    fontSize: '9px',
    color: 'var(--text-muted)',
  },
  panel: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-lg)',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '4px',
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHint: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  listActions: {
    display: 'flex',
    gap: '4px',
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: '14px',
    padding: '0 4px',
    fontFamily: 'var(--font-mono)',
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  configHint: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    margin: 0,
  },
  input: {
    padding: '7px 0',
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
  configActions: {
    display: 'flex',
    gap: '6px',
  },
  saveBtn: {
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
  cancelBtn: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  errorText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--state-error)',
    margin: 0,
  },
  successText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--state-success)',
    margin: 0,
  },
  infoBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  infoText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    margin: 0,
  },
  infoItem: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    margin: 0,
    paddingLeft: '8px',
  },
};
