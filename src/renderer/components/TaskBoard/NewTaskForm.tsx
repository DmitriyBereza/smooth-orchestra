import React, { useState, useEffect, useRef } from 'react';
import { PipelineType } from '../../store/sessionStore';
import { SHARED_PIPELINE_CONFIGS } from '../../../shared/pipeline-configs';
import { MODEL_GROUPS, CURSOR_PROVIDER, getModelLabel } from '../../../shared/model-helpers';
import { Code, Megaphone, Palette } from '@phosphor-icons/react';

type AgentRole = string;

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
  onSubmit: (title: string, description: string, scheduledAt?: string, models?: Record<string, string>, jiraIssueKey?: string, createJiraIssue?: boolean, pipelineType?: PipelineType, autoApproveSpec?: boolean) => void;
  disabled?: boolean;
  initialTitle?: string;
  initialDescription?: string;
  initialJiraKey?: string;
  /** Prefills the per-role model dropdowns (used by restart flow). */
  initialModels?: Record<string, string>;
  jiraConfigured?: boolean;
  /** When provided, sets the pipeline type on the form (e.g. when the form is pre-filled from a backlog promote). */
  initialPipelineType?: PipelineType;
  /** When true, auto-expands the model picker and scrolls it into view. Bumps via the changing key prompt the user to confirm models. */
  focusModelsToken?: number;
  /** Banner to show above the form when a flow is in progress (e.g. promoting a backlog item). Set null to hide. */
  banner?: { text: string; tone?: 'info' | 'warn' } | null;
  /** Whether the Cursor CLI is installed on the system. When false, Cursor model options are disabled. */
  cursorAvailable?: boolean;
}

const MIXED_SENTINEL = '__mixed__';

const DELAY_PRESETS = [
  { label: '5 min', minutes: 5 },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hr', minutes: 60 },
  { label: '2 hr', minutes: 120 },
];

const PIPELINE_TYPE_OPTIONS: { type: PipelineType; label: string; description: string; icon: React.ReactNode; color: string }[] = [
  { type: 'development', label: 'Dev', description: 'Software engineering', icon: <Code weight="bold" size={16} />, color: 'var(--pipeline-dev-color)' },
  { type: 'marketing', label: 'Marketing', description: 'Campaign & content', icon: <Megaphone weight="bold" size={16} />, color: 'var(--pipeline-marketing-color)' },
  { type: 'design', label: 'Design', description: 'UX/UI design', icon: <Palette weight="bold" size={16} />, color: 'var(--pipeline-design-color)' },
];

function toLocalDatetimeValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onSubmit, disabled, initialTitle = '', initialDescription = '', initialJiraKey, initialModels, jiraConfigured, initialPipelineType, focusModelsToken, banner, cursorAvailable = true }) => {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [jiraIssueKey, setJiraIssueKey] = useState(initialJiraKey ?? '');
  const [createJiraIssue, setCreateJiraIssue] = useState(false);
  const [autoApproveSpec, setAutoApproveSpec] = useState(false);
  const [models, setModels] = useState<Record<string, string>>({});
  const [showModels, setShowModels] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'delay' | 'custom'>('now');
  const [delayMinutes, setDelayMinutes] = useState<number | null>(null);
  const [customDatetime, setCustomDatetime] = useState('');
  const [pipelineType, setPipelineType] = useState<PipelineType>(initialPipelineType ?? 'development');
  const modelsSectionRef = useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (initialTitle) setTitle(initialTitle);
    if (initialDescription) setDescription(initialDescription);
    if (initialJiraKey !== undefined) setJiraIssueKey(initialJiraKey ?? '');
  }, [initialTitle, initialDescription, initialJiraKey]);

  React.useEffect(() => {
    if (initialPipelineType) setPipelineType(initialPipelineType);
  }, [initialPipelineType]);

  // When the parent bumps focusModelsToken (e.g. user clicked "Promote to pipeline"
  // on a backlog card), expand the model panel and scroll it into view so the user
  // confirms model picks before submitting.
  React.useEffect(() => {
    if (focusModelsToken == null) return;
    setShowModels(true);
    if (initialModels) {
      setModels(initialModels);
    } else {
      setModels({});
    }
    requestAnimationFrame(() => {
      modelsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusModelsToken, initialModels]);

  const pipelineConfig = SHARED_PIPELINE_CONFIGS[pipelineType];
  const agentRolesForPipeline = pipelineConfig.modelSelectorRoles;

  const setModelForRole = (role: string, value: string) => {
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
    if (value === MIXED_SENTINEL) {
      return;
    }
    if (!value) {
      setModels({});
    } else {
      const next: Record<string, string> = {};
      for (const { role } of agentRolesForPipeline) {
        next[role] = value;
      }
      setModels(next);
    }
  };

  const handlePipelineTypeChange = (type: PipelineType) => {
    setPipelineType(type);
    setModels({});
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
    const modelsToSend = Object.keys(models).length > 0 ? models : undefined;
    onSubmit(
      title.trim(),
      description.trim(),
      getScheduledAt(),
      modelsToSend,
      jiraIssueKey.trim() || undefined,
      createJiraIssue && !jiraIssueKey.trim(),
      pipelineType,
      autoApproveSpec || undefined,
    );
    setTitle('');
    setDescription('');
    setModels({});
    setScheduleMode('now');
    setDelayMinutes(null);
    setCustomDatetime('');
    setJiraIssueKey('');
    setCreateJiraIssue(false);
    setAutoApproveSpec(false);
  };

  const scheduleLabel = (() => {
    if (scheduleMode === 'delay' && delayMinutes) {
      return `start in ${delayMinutes >= 60 ? `${delayMinutes / 60} hr` : `${delayMinutes} min`}`;
    }
    if (scheduleMode === 'custom' && customDatetime) {
      return `start at ${new Date(customDatetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return null;
  })();

  const allSameModel = (() => {
    const values = Object.values(models);
    if (values.length === 0) return '';
    if (values.length === agentRolesForPipeline.length && new Set(values).size === 1) return values[0];
    return null;
  })();

  const modelSummary = (() => {
    const count = Object.keys(models).length;
    if (count === 0) return 'default';
    if (allSameModel) {
      return `all: ${getModelLabel(allSameModel)}`;
    }
    return `${count} customized`;
  })();

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h3 style={styles.heading}>new task</h3>

      {banner && (
        <div
          style={{
            ...styles.banner,
            ...(banner.tone === 'warn'
              ? { borderColor: 'var(--state-warning, var(--state-error))', color: 'var(--state-warning, var(--state-error))' }
              : {}),
          }}
        >
          {banner.text}
        </div>
      )}

      {/* Pipeline type selector */}
      <div style={styles.pipelineSection}>
        <span style={styles.sectionLabel}>select pipeline</span>
        <div style={styles.pipelineOptions}>
          {PIPELINE_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              title={opt.description}
              style={{
                ...styles.pipelineBtn,
                ...(pipelineType === opt.type
                  ? { ...styles.pipelineBtnActive, borderColor: opt.color, color: opt.color }
                  : {}),
              }}
              onClick={() => handlePipelineTypeChange(opt.type)}
              disabled={disabled}
            >
              <span style={styles.pipelineIcon}>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        placeholder="> task title_"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={styles.input}
        onFocus={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-active)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderBottomColor = 'var(--border-input)';
        }}
        disabled={disabled}
      />
      <textarea
        placeholder="> describe requirements, expected behavior, constraints..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        style={styles.textarea}
        rows={isMobile ? 3 : 6}
        disabled={disabled}
      />

      {/* Model selector — collapsible */}
      <div style={styles.modelSection} ref={modelsSectionRef}>
        <button
          type="button"
          style={styles.modelToggle}
          onClick={() => setShowModels(!showModels)}
        >
          <span style={styles.sectionLabel}>models</span>
          <span style={styles.modelSummary}>{modelSummary}</span>
          <span style={styles.chevron}>{showModels ? '▲' : '▼'}</span>
        </button>

        {showModels && (
          <div style={styles.modelPanel}>
            {!cursorAvailable && (
              <div style={styles.modelHint}>⚠ Cursor CLI not installed — Composer models disabled</div>
            )}

            {/* Quick-set all */}
            <div style={styles.modelRow}>
              <span style={{ ...styles.roleLabel, fontWeight: 'var(--weight-bold)' }}>all</span>
              <select
                style={styles.modelSelect}
                value={allSameModel ?? MIXED_SENTINEL}
                onChange={(e) => setAllModels(e.target.value)}
                disabled={disabled}
              >
                {allSameModel === null && (
                  <option value={MIXED_SENTINEL} disabled>Mixed</option>
                )}
                <option value="">Default</option>
                {MODEL_GROUPS.map((group) => (
                  <optgroup key={group.provider} label={group.provider}>
                    {group.options.map((opt) => {
                      const isCursorOpt = group.provider === CURSOR_PROVIDER;
                      const requiresPaidCursorPlan = isCursorOpt && opt.value !== 'cursor-auto';
                      const isDisabled = (isCursorOpt && !cursorAvailable) || requiresPaidCursorPlan;
                      return (
                        <option key={opt.value} value={opt.value} disabled={isDisabled}>
                          {opt.label}
                          {isCursorOpt && !cursorAvailable ? ' (not available)' : ''}
                          {requiresPaidCursorPlan ? ' (paid plan)' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={styles.modelDivider} />

            {agentRolesForPipeline.map(({ role, label, color }) => (
              <div key={role} style={styles.modelRow}>
                <span style={{ ...styles.roleLabel, color }}>{label}</span>
                <select
                  style={styles.modelSelect}
                  value={models[role] ?? ''}
                  onChange={(e) => setModelForRole(role, e.target.value)}
                  disabled={disabled}
                >
                  <option value="">Default</option>
                  {MODEL_GROUPS.map((group) => (
                    <optgroup key={group.provider} label={group.provider}>
                      {group.options.map((opt) => {
                        const isCursorOpt = group.provider === CURSOR_PROVIDER;
                        const requiresPaidCursorPlan = isCursorOpt && opt.value !== 'cursor-auto';
                        const isDisabled = (isCursorOpt && !cursorAvailable) || requiresPaidCursorPlan;
                        return (
                          <option key={opt.value} value={opt.value} disabled={isDisabled}>
                            {opt.label}
                            {isCursorOpt && !cursorAvailable ? ' (not available)' : ''}
                            {requiresPaidCursorPlan ? ' (paid plan)' : ''}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Schedule controls */}
      <div style={styles.scheduleSection}>
        <div style={styles.scheduleHeader}>
          <span style={styles.sectionLabel}>schedule</span>
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
                {mode}
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
              <span style={styles.jiraCheckboxLabel}>create jira issue</span>
            </label>
          )}
        </div>
      )}

      {/* Auto-approve spec */}
      <label style={styles.jiraCheckbox}>
        <input
          type="checkbox"
          checked={autoApproveSpec}
          onChange={(e) => setAutoApproveSpec(e.target.checked)}
          disabled={disabled}
          style={{ marginRight: 6 }}
        />
        <span style={styles.jiraCheckboxLabel}>auto-approve spec</span>
      </label>

      <button
        type="submit"
        style={{
          ...styles.button,
          ...(scheduleMode !== 'now' ? styles.buttonScheduled : {}),
          opacity: disabled || !title.trim() || !description.trim() ? 0.5 : 1,
        }}
        disabled={disabled || !title.trim() || !description.trim()}
      >
        {scheduleLabel ?? './run pipeline'}
      </button>
    </form>
  );
};

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  heading: {
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
  },
  banner: {
    padding: '6px 8px',
    border: '1px dashed var(--brand-primary)',
    color: 'var(--brand-primary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
  },
  pipelineSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  pipelineOptions: {
    display: 'flex',
    gap: '6px',
  },
  pipelineBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '6px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-medium)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  pipelineBtnActive: {
    backgroundColor: 'var(--brand-muted)',
    fontWeight: 'var(--weight-semibold)',
  },
  pipelineIcon: {
    fontSize: '14px',
  },
  input: {
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-input)',
    borderRadius: 0,
    color: 'var(--text-primary)',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    width: '100%',
  },
  textarea: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-mono)',
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
    gap: '8px',
    padding: '6px 0',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
  },
  sectionLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  modelSummary: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    flex: 1,
    textAlign: 'right' as const,
  },
  chevron: {
    fontSize: '9px',
    color: 'var(--text-muted)',
  },
  modelPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px 10px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-input)',
    marginTop: '4px',
  },
  modelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  roleLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
    width: '80px',
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  modelSelect: {
    flex: 1,
    padding: '4px 8px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    outline: 'none',
    colorScheme: 'dark',
  },
  modelHint: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    marginBottom: '2px',
  },
  modelDivider: {
    height: '1px',
    backgroundColor: 'var(--border-color)',
    margin: '2px 0',
  },
  scheduleSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  scheduleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeTabs: {
    display: 'flex',
    gap: '2px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: 'var(--radius-md)',
    padding: '2px',
  },
  modeTab: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-medium)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  modeTabActive: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  presets: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap' as const,
  },
  presetButton: {
    padding: '5px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  presetActive: {
    backgroundColor: 'var(--brand-muted)',
    color: 'var(--brand-primary)',
    borderColor: 'var(--border-active)',
  },
  datetimeInput: {
    padding: '8px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-base)',
    fontFamily: 'var(--font-mono)',
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
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  jiraCheckboxLabel: {
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  jiraLinked: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 8px',
    backgroundColor: 'var(--jira-badge-bg)',
    border: '1px solid var(--jira-badge-border)',
    borderRadius: 'var(--radius-md)',
  },
  jiraKey: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--jira-badge-color)',
  },
  jiraLinkedLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    flex: 1,
  },
  jiraUnlink: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-xs)',
    padding: 0,
    fontFamily: 'var(--font-mono)',
  },
  button: {
    padding: '10px 16px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-md)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  buttonScheduled: {
    backgroundColor: 'var(--role-architect)',
  },
};
