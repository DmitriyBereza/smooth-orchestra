import React, { useState, useEffect } from 'react';

type AgentRole = 'po' | 'architect' | 'tech-lead' | 'developer' | 'qa';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

interface NewTaskFormProps {
  onSubmit: (title: string, description: string, scheduledAt?: string, models?: Record<string, string>, jiraIssueKey?: string, createJiraIssue?: boolean) => void;
  disabled?: boolean;
  /** Pre-fill from a Jira import */
  initialTitle?: string;
  initialDescription?: string;
  initialJiraKey?: string;
  jiraConfigured?: boolean;
}

const MODEL_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'claude-opus-4-6', label: 'Opus' },
  { value: 'claude-sonnet-4-6', label: 'Sonnet' },
  { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
];

const AGENT_ROLES: { role: AgentRole; label: string; color: string }[] = [
  { role: 'po', label: 'PO', color: '#3B82F6' },
  { role: 'architect', label: 'Architect', color: '#8B5CF6' },
  { role: 'tech-lead', label: 'Tech Lead', color: '#F97316' },
  { role: 'developer', label: 'Developer', color: '#22C55E' },
  { role: 'qa', label: 'QA', color: '#EF4444' },
];

const DELAY_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
];

function toLocalDatetimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onSubmit, disabled, initialTitle = '', initialDescription = '', initialJiraKey, jiraConfigured }) => {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [jiraIssueKey, setJiraIssueKey] = useState(initialJiraKey ?? '');
  const [createJiraIssue, setCreateJiraIssue] = useState(false);
  const [models, setModels] = useState<Partial<Record<AgentRole, string>>>({});
  const [showModels, setShowModels] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'delay' | 'custom'>('now');
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null);
  const [customDatetime, setCustomDatetime] = useState('');

  // Sync when parent injects new Jira import values
  React.useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
    if (initialJiraKey !== undefined) setJiraIssueKey(initialJiraKey ?? '');
  }, [initialTitle, initialDescription, initialJiraKey]);

  const setModelForRole = (role: AgentRole, value: string) => {
    setModels((prev) => {
      const next = { ...prev };
      if (value) {
        next[role] = value;
      } else {
        delete next[role];
      }
      return next;
    });
  };

  const setAllModels = (value: string) => {
    if (!value) {
      setModels({});
    } else {
      const next: Partial<Record<AgentRole, string>> = {};
      for (const { role } of AGENT_ROLES) {
        next[role] = value;
      }
      setModels(next);
    }
  };

  const getScheduledAt = (): string | undefined => {
    if (scheduleMode === 'delay' && delayMinutes) {
      return new Date(Date.now() + delayMinutes * 60000).toISOString();
    }
    if (scheduleMode === 'custom' && customDatetime) {
      return new Date(customDatetime).toISOString();
    }
    return undefined;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    const modelsToSend = Object.keys(models).length > 0 ? models as Record<string, string> : undefined;
    onSubmit(
      title.trim(),
      description.trim(),
      getScheduledAt(),
      modelsToSend,
      jiraIssueKey.trim() || undefined,
      createJiraIssue && !jiraIssueKey.trim(),
    );
    setTitle('');
    setDescription('');
    setModels({});
    setScheduleMode('now');
    setDelayMinutes(null);
    setCustomDatetime('');
    setJiraIssueKey('');
    setCreateJiraIssue(false);
  };

  const scheduleLabel = (() => {
    if (scheduleMode === 'delay' && delayMinutes) {
      return `Start in ${delayMinutes >= 60 ? `${delayMinutes / 60} hr` : `${delayMinutes} min`}`;
    }
    if (scheduleMode === 'custom' && customDatetime) {
      return `Start at ${new Date(customDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return null;
  })();

  // Check if all roles have the same model (for the "All" quick-set)
  const allSameModel = (() => {
    const values = Object.values(models);
    if (values.length === 0) return '';
    if (values.length === AGENT_ROLES.length && new Set(values).size === 1) return values[0];
    return null; // mixed
  })();

  const modelSummary = (() => {
    const count = Object.keys(models).length;
    if (count === 0) return 'Default';
    if (allSameModel) {
      const opt = MODEL_OPTIONS.find((m) => m.value === allSameModel);
      return `All: ${opt?.label ?? allSameModel}`;
    }
    return `${count} customized`;
  })();

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
        rows={isMobile ? 3 : 6}
        disabled={disabled}
      />

      {/* Model selector — collapsible */}
      <div style={styles.modelSection}>
        <button
          type="button"
          style={styles.modelToggle}
          onClick={() => setShowModels(!showModels)}
        >
          <span style={styles.sectionLabel}>Models</span>
          <span style={styles.modelSummary}>{modelSummary}</span>
          <span style={styles.chevron}>{showModels ? '\u25B2' : '\u25BC'}</span>
        </button>

        {showModels && (
          <div style={styles.modelPanel}>
            {/* Quick-set all */}
            <div style={styles.modelRow}>
              <span style={{ ...styles.roleLabel, fontWeight: 700 }}>All</span>
              <div style={styles.modelButtons}>
                {MODEL_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    style={{
                      ...styles.modelBtn,
                      ...(allSameModel === opt.value ? styles.modelBtnActive : {}),
                    }}
                    onClick={() => setAllModels(opt.value)}
                    disabled={disabled}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.modelDivider} />

            {/* Per-role selectors */}
            {AGENT_ROLES.map(({ role, label, color }) => (
              <div key={role} style={styles.modelRow}>
                <span style={{ ...styles.roleLabel, color }}>{label}</span>
                <div style={styles.modelButtons}>
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      style={{
                        ...styles.modelBtn,
                        ...((models[role] ?? '') === opt.value ? styles.modelBtnActive : {}),
                      }}
                      onClick={() => setModelForRole(role, opt.value)}
                      disabled={disabled}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule controls */}
      <div style={styles.scheduleSection}>
        <div style={styles.scheduleHeader}>
          <span style={styles.sectionLabel}>Schedule</span>
          <div style={styles.modeTabs}>
            {(['now', 'delay', 'custom'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                style={{
                  ...styles.modeTab,
                  ...(scheduleMode === mode ? styles.modeTabActive : {}),
                }}
                onClick={() => {
                  setScheduleMode(mode);
                  if (mode === 'now') { setDelayMinutes(null); setCustomDatetime(''); }
                }}
                disabled={disabled}
              >
                {mode === 'now' ? 'Now' : mode === 'delay' ? 'Delay' : 'Time'}
              </button>
            ))}
          </div>
        </div>

        {scheduleMode === 'delay' && (
          <div style={styles.presets}>
            {DELAY_PRESETS.map((p) => (
              <button
                key={p.minutes}
                type="button"
                style={{
                  ...styles.presetButton,
                  ...(delayMinutes === p.minutes ? styles.presetActive : {}),
                }}
                onClick={() => setDelayMinutes(p.minutes)}
                disabled={disabled}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {scheduleMode === 'custom' && (
          <input
            type="datetime-local"
            value={customDatetime}
            onChange={(e) => setCustomDatetime(e.target.value)}
            min={toLocalDatetimeValue(new Date())}
            style={styles.datetimeInput}
            disabled={disabled}
          />
        )}
      </div>

      {/* Jira linking */}
      {jiraConfigured !== false && (
        <div style={styles.jiraSection}>
          {jiraIssueKey ? (
            <div style={styles.jiraLinked}>
              <span style={styles.jiraKey}>{jiraIssueKey}</span>
              <span style={styles.jiraLinkedLabel}>linked</span>
              <button
                type="button"
                style={styles.jiraUnlink}
                onClick={() => setJiraIssueKey('')}
              >
                ✕
              </button>
            </div>
          ) : (
            <label style={styles.jiraCheckbox}>
              <input
                type="checkbox"
                checked={createJiraIssue}
                onChange={(e) => setCreateJiraIssue(e.target.checked)}
                disabled={disabled}
                style={{ marginRight: 6 }}
              />
              <span style={styles.jiraCheckboxLabel}>Create Jira issue</span>
            </label>
          )}
        </div>
      )}

      <button
        type="submit"
        style={{
          ...styles.button,
          ...(scheduleMode !== 'now' ? styles.buttonScheduled : {}),
          opacity: disabled || !title.trim() || !description.trim() ? 0.5 : 1,
        }}
        disabled={disabled || !title.trim() || !description.trim()}
      >
        {scheduleLabel ?? 'Start Pipeline'}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  heading: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 4,
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
  textarea: {
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 6,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    resize: 'vertical' as const,
    outline: 'none',
    lineHeight: 1.5,
  },
  modelSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  modelToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  modelSummary: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    flex: 1,
    textAlign: 'right' as const,
  },
  chevron: {
    fontSize: 9,
    color: 'var(--text-muted)',
  },
  modelPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: '8px 10px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
    marginTop: 4,
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  roleLabel: {
    fontSize: 11,
    fontWeight: 600,
    width: 64,
    flexShrink: 0,
  },
  modelButtons: {
    display: 'flex',
    gap: 4,
    flex: 1,
  },
  modelBtn: {
    padding: '3px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    border: '1px solid transparent',
    borderRadius: 3,
    fontSize: 10,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    flex: 1,
    textAlign: 'center' as const,
  },
  modelBtnActive: {
    backgroundColor: 'var(--accent-blue)',
    color: 'white',
  },
  modelDivider: {
    height: 1,
    backgroundColor: 'var(--border-color)',
    margin: '2px 0',
  },
  scheduleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  scheduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeTabs: {
    display: 'flex',
    gap: 2,
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 4,
    padding: 2,
  },
  modeTab: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    borderRadius: 3,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  modeTabActive: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  presets: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  presetButton: {
    padding: '5px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  presetActive: {
    backgroundColor: 'var(--accent-blue)',
    color: 'white',
    borderColor: 'var(--accent-blue)',
  },
  datetimeInput: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    colorScheme: 'dark',
  },
  jiraSection: {
    display: 'flex',
    alignItems: 'center',
  },
  jiraCheckbox: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: 12,
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-sans)',
  },
  jiraCheckboxLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  jiraLinked: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    backgroundColor: 'rgba(0, 82, 204, 0.15)',
    border: '1px solid rgba(0, 82, 204, 0.4)',
    borderRadius: 4,
  },
  jiraKey: {
    fontSize: 11,
    fontWeight: 700,
    color: '#4D9FFF',
    fontFamily: 'var(--font-mono)',
  },
  jiraLinkedLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    flex: 1,
  },
  jiraUnlink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 11,
    padding: 0,
    fontFamily: 'var(--font-sans)',
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
  },
  buttonScheduled: {
    backgroundColor: 'var(--accent-purple)',
  },
};
