import React, { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description: string;
  status: string;
  issueType: string;
  url: string;
}

interface JiraImportPanelProps {
  onImport: (issue: JiraIssue) => void;
  disabled?: boolean;
}

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

export const JiraImportPanel: React.FC<JiraImportPanelProps> = ({ onImport, disabled }) => {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  // Config form state
  const [showConfig, setShowConfig] = useState(false);
  const [cfgSiteUrl, setCfgSiteUrl] = useState('');
  const [cfgProjectKey, setCfgProjectKey] = useState('');
  const [cfgEmail, setCfgEmail] = useState('');
  const [cfgToken, setCfgToken] = useState('');
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgError, setCfgError] = useState<string | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/jira/issues', token);
      setIssues(data.issues ?? []);
      setConfigured(true);
    } catch (err: any) {
      if (err.message?.includes('not configured')) {
        setConfigured(false);
        setShowConfig(true);
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadConfig = useCallback(async () => {
    try {
      const data = await apiFetch('/api/jira/config', token);
      setConfigured(data.configured);
      if (data.config) {
        setCfgSiteUrl(data.config.siteUrl ?? '');
        setCfgProjectKey(data.config.projectKey ?? '');
        setCfgEmail(data.config.email ?? '');
      }
    } catch {
      // ignore
    }
  }, [token]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next && issues.length === 0) {
      loadConfig().then(() => loadIssues());
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setCfgSaving(true);
    setCfgError(null);
    try {
      await apiFetch('/api/jira/config', token, {
        method: 'POST',
        body: JSON.stringify({
          siteUrl: cfgSiteUrl.replace(/\/$/, ''),
          cloudId: '',
          projectKey: cfgProjectKey.trim().toUpperCase(),
          email: cfgEmail.trim(),
          apiToken: cfgToken.trim(),
        }),
      });
      setShowConfig(false);
      setConfigured(true);
      await loadIssues();
    } catch (err: any) {
      setCfgError(err.message);
    } finally {
      setCfgSaving(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'Done') return '#22C55E';
    if (status === 'In Progress') return '#F59E0B';
    return '#6B7280';
  };

  return (
    <div style={styles.container}>
      <button
        type="button"
        style={styles.toggle}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span style={styles.toggleIcon}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 11.513H0l10.393 6 11.22-6.5-10.042-5.5zm0 0"/>
          </svg>
        </span>
        <span style={styles.toggleLabel}>Import from Jira</span>
        <span style={styles.chevron}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={styles.panel}>
          {/* Config form */}
          {showConfig && (
            <form onSubmit={handleSaveConfig} style={styles.configForm}>
              <p style={styles.configHint}>Connect your Jira workspace to import issues.</p>
              <input
                style={styles.input}
                placeholder="Site URL (e.g. https://yourco.atlassian.net)"
                value={cfgSiteUrl}
                onChange={(e) => setCfgSiteUrl(e.target.value)}
                required
              />
              <input
                style={styles.input}
                placeholder="Project key (e.g. TRA)"
                value={cfgProjectKey}
                onChange={(e) => setCfgProjectKey(e.target.value)}
                required
              />
              <input
                style={styles.input}
                placeholder="Atlassian email"
                value={cfgEmail}
                onChange={(e) => setCfgEmail(e.target.value)}
                required
              />
              <input
                style={styles.input}
                type="password"
                placeholder="API token (from id.atlassian.com/manage-profile/security)"
                value={cfgToken}
                onChange={(e) => setCfgToken(e.target.value)}
                required
              />
              {cfgError && <p style={styles.errorText}>{cfgError}</p>}
              <div style={styles.configActions}>
                <button type="submit" style={styles.saveBtn} disabled={cfgSaving}>
                  {cfgSaving ? 'Saving…' : 'Save & Connect'}
                </button>
                {configured && (
                  <button type="button" style={styles.cancelBtn} onClick={() => setShowConfig(false)}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Issue list */}
          {!showConfig && (
            <>
              <div style={styles.listHeader}>
                <span style={styles.listHint}>To Do issues</span>
                <div style={styles.listActions}>
                  <button type="button" style={styles.iconBtn} onClick={loadIssues} title="Refresh" disabled={loading}>
                    ↻
                  </button>
                  <button type="button" style={styles.iconBtn} onClick={() => setShowConfig(true)} title="Settings">
                    ⚙
                  </button>
                </div>
              </div>

              {loading && <p style={styles.hint}>Loading…</p>}
              {error && <p style={styles.errorText}>{error}</p>}
              {!loading && !error && issues.length === 0 && (
                <p style={styles.hint}>No "To Do" issues found.</p>
              )}

              <div style={styles.issueList}>
                {issues.map((issue) => (
                  <div key={issue.id} style={styles.issueRow}>
                    <div style={styles.issueMain}>
                      <span
                        style={{ ...styles.issueKey, color: statusColor(issue.status) }}
                      >
                        {issue.key}
                      </span>
                      <span style={styles.issueSummary}>{issue.summary}</span>
                    </div>
                    <button
                      type="button"
                      style={styles.importBtn}
                      onClick={() => {
                        onImport(issue);
                        setOpen(false);
                      }}
                      title="Import this issue as a task"
                    >
                      ↓ Use
                    </button>
                  </div>
                ))}
              </div>
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
    gap: 8,
    padding: '6px 0',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-secondary)',
    textAlign: 'left',
  },
  toggleIcon: {
    color: '#0052CC',
    display: 'flex',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    flex: 1,
  },
  chevron: {
    fontSize: 9,
    color: 'var(--text-muted)',
  },
  panel: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 4,
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listHint: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
  listActions: {
    display: 'flex',
    gap: 4,
  },
  iconBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 14,
    padding: '0 4px',
    fontFamily: 'var(--font-sans)',
  },
  issueList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 200,
    overflowY: 'auto',
  },
  issueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 6px',
    borderRadius: 4,
    backgroundColor: 'var(--bg-tertiary)',
  },
  issueMain: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  issueKey: {
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.03em',
  },
  issueSummary: {
    fontSize: 11,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  importBtn: {
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 600,
    backgroundColor: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    flexShrink: 0,
  },
  hint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    margin: 0,
  },
  errorText: {
    fontSize: 11,
    color: 'var(--accent-red)',
    margin: 0,
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  configHint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    margin: 0,
  },
  input: {
    padding: '7px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  configActions: {
    display: 'flex',
    gap: 6,
  },
  saveBtn: {
    padding: '6px 12px',
    backgroundColor: '#0052CC',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  cancelBtn: {
    padding: '6px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};
