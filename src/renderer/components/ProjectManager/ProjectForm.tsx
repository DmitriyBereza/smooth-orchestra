import React, { useState } from 'react';
import {
  useProjectStore,
  ProjectRecord,
  ManualQaConfig,
  PrConfig,
  StandbyProjectConfig,
} from '../../store/projectStore';

interface ProjectFormProps {
  project: ProjectRecord | null; // null = create mode
  onClose: () => void;
}

interface UrlEntry {
  label: string;
  url: string;
}

const recordToEntries = (urls?: Record<string, string>): UrlEntry[] =>
  urls
    ? Object.entries(urls).map(([label, url]) => ({ label, url }))
    : [];

const entriesToRecord = (entries: UrlEntry[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const { label, url } of entries) {
    const l = label.trim();
    const u = url.trim();
    if (l && u) out[l] = u;
  }
  return out;
};

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose }) => {
  const { createProject, updateProject } = useProjectStore();
  const [name, setName] = useState(project?.name ?? '');
  const [path, setPath] = useState(project?.path ?? '');
  const [labelInput, setLabelInput] = useState(project?.labels.join(', ') ?? '');
  const [showAdvanced, setShowAdvanced] = useState(
    !!(project?.manualQa || project?.pr || project?.standby),
  );

  // Manual QA state
  const [qaMode, setQaMode] = useState<ManualQaConfig['mode']>(
    project?.manualQa?.mode ?? 'off',
  );
  const [previewCommand, setPreviewCommand] = useState(
    project?.manualQa?.previewCommand ?? '',
  );
  const [previewPort, setPreviewPort] = useState<string>(
    project?.manualQa?.previewPort != null
      ? String(project.manualQa.previewPort)
      : '',
  );
  const [urlEntries, setUrlEntries] = useState<UrlEntry[]>(
    recordToEntries(project?.manualQa?.urls),
  );

  // PR state
  const [prEnabled, setPrEnabled] = useState(project?.pr?.enabled ?? false);
  const [prBaseBranch, setPrBaseBranch] = useState(project?.pr?.baseBranch ?? '');
  const [prTitleTemplate, setPrTitleTemplate] = useState(
    project?.pr?.titleTemplate ?? '',
  );
  const [prBodyTemplate, setPrBodyTemplate] = useState(
    project?.pr?.bodyTemplate ?? '',
  );

  // Standby state
  const [standbyEnabled, setStandbyEnabled] = useState(
    project?.standby?.enabled ?? false,
  );

  const [saving, setSaving] = useState(false);

  const updateUrlEntry = (idx: number, patch: Partial<UrlEntry>) => {
    setUrlEntries((entries) =>
      entries.map((e, i) => (i === idx ? { ...e, ...patch } : e)),
    );
  };
  const addUrlEntry = () =>
    setUrlEntries((entries) => [...entries, { label: '', url: '' }]);
  const removeUrlEntry = (idx: number) =>
    setUrlEntries((entries) => entries.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;

    const labels = labelInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    let manualQa: ManualQaConfig | undefined;
    if (qaMode !== 'off') {
      manualQa = {
        mode: qaMode,
        ...(previewCommand.trim() ? { previewCommand: previewCommand.trim() } : {}),
        ...(previewPort.trim() ? { previewPort: Number(previewPort) } : {}),
        ...(urlEntries.length ? { urls: entriesToRecord(urlEntries) } : {}),
      };
    } else if (project?.manualQa) {
      manualQa = { mode: 'off' };
    }

    let pr: PrConfig | undefined;
    if (prEnabled && prBaseBranch.trim()) {
      pr = {
        enabled: true,
        baseBranch: prBaseBranch.trim(),
        ...(prTitleTemplate.trim() ? { titleTemplate: prTitleTemplate.trim() } : {}),
        ...(prBodyTemplate.trim() ? { bodyTemplate: prBodyTemplate.trim() } : {}),
      };
    } else if (project?.pr) {
      pr = { enabled: false };
    }

    let standby: StandbyProjectConfig | undefined;
    if (standbyEnabled) {
      standby = { enabled: true };
    } else if (project?.standby) {
      standby = { enabled: false };
    }

    setSaving(true);
    try {
      if (project) {
        await updateProject(project.id, {
          name: name.trim(),
          path: path.trim(),
          labels,
          ...(manualQa ? { manualQa } : {}),
          ...(pr ? { pr } : {}),
          ...(standby ? { standby } : {}),
        });
      } else {
        await createProject(name.trim(), path.trim(), labels, {
          ...(manualQa ? { manualQa } : {}),
          ...(pr ? { pr } : {}),
          ...(standby ? { standby } : {}),
        });
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
        autoFocus
      />

      <input
        type="text"
        placeholder="> absolute path_"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        style={styles.input}
      />

      <input
        type="text"
        placeholder="> labels (comma-separated)_"
        value={labelInput}
        onChange={(e) => setLabelInput(e.target.value)}
        style={styles.input}
      />

      <button
        type="button"
        style={styles.advancedToggle}
        onClick={() => setShowAdvanced((s) => !s)}
      >
        {showAdvanced ? '▾ advanced (manual qa, auto-pr)' : '▸ advanced (manual qa, auto-pr)'}
      </button>

      {showAdvanced && (
        <div style={styles.advancedSection}>
          <div style={styles.sectionLabel}>manual qa</div>
          <div style={styles.helpText}>
            QA agent uses these settings to walk acceptance criteria as a real user.
          </div>

          <label style={styles.fieldLabel}>mode</label>
          <select
            value={qaMode}
            onChange={(e) => setQaMode(e.target.value as ManualQaConfig['mode'])}
            style={styles.select}
          >
            <option value="off">off — automated QA only (default)</option>
            <option value="local">local — start a local dev server (Claude Preview)</option>
            <option value="remote">remote — open deployed URLs (Claude in Chrome)</option>
            <option value="both">both — try remote first, fall back to local</option>
          </select>

          {(qaMode === 'local' || qaMode === 'both') && (
            <>
              <label style={styles.fieldLabel}>preview command</label>
              <input
                type="text"
                placeholder="npm run dev"
                value={previewCommand}
                onChange={(e) => setPreviewCommand(e.target.value)}
                style={styles.input}
              />
              <label style={styles.fieldLabel}>preview port (optional)</label>
              <input
                type="text"
                placeholder="5173"
                value={previewPort}
                onChange={(e) => setPreviewPort(e.target.value)}
                style={styles.input}
              />
            </>
          )}

          {(qaMode === 'remote' || qaMode === 'both') && (
            <>
              <label style={styles.fieldLabel}>
                deployed urls (label → url, supports {'{branch}'} {'{taskId}'})
              </label>
              <div style={styles.urlList}>
                {urlEntries.map((entry, idx) => (
                  <div key={idx} style={styles.urlRow}>
                    <input
                      type="text"
                      placeholder="label (e.g. vercel-preview)"
                      value={entry.label}
                      onChange={(e) => updateUrlEntry(idx, { label: e.target.value })}
                      style={{ ...styles.input, flex: '0 0 38%' }}
                    />
                    <input
                      type="text"
                      placeholder="https://app-git-{branch}.vercel.app"
                      value={entry.url}
                      onChange={(e) => updateUrlEntry(idx, { url: e.target.value })}
                      style={{ ...styles.input, flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={() => removeUrlEntry(idx)}
                      style={styles.removeButton}
                      title="remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addUrlEntry} style={styles.addUrlButton}>
                  + add url
                </button>
              </div>
              <div style={styles.helpText}>
                Tip: a label containing "status" (e.g. "coolify-status") is treated as a deploy-status URL — QA checks it before clicking the preview.
              </div>
            </>
          )}

          <div style={{ ...styles.sectionLabel, marginTop: '14px' }}>standby loop</div>
          <div style={styles.helpText}>
            When standby is on globally, this project is included in the (role × project) round-robin every minute. Default off so opting in is explicit per project.
          </div>
          <label style={{ ...styles.fieldLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={standbyEnabled}
              onChange={(e) => setStandbyEnabled(e.target.checked)}
            />
            include in standby loop
          </label>

          <div style={{ ...styles.sectionLabel, marginTop: '14px' }}>auto-pr</div>
          <div style={styles.helpText}>
            When enabled, developer pushes the branch and opens a PR against the base branch automatically.
          </div>

          <label style={{ ...styles.fieldLabel, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={prEnabled}
              onChange={(e) => setPrEnabled(e.target.checked)}
            />
            enable auto-pr
          </label>

          {prEnabled && (
            <>
              <label style={styles.fieldLabel}>base branch</label>
              <input
                type="text"
                placeholder="qa"
                value={prBaseBranch}
                onChange={(e) => setPrBaseBranch(e.target.value)}
                style={styles.input}
              />
              <label style={styles.fieldLabel}>
                title template (optional, supports {'{taskId}'} {'{title}'} {'{branch}'})
              </label>
              <input
                type="text"
                placeholder="{taskId}: {title}"
                value={prTitleTemplate}
                onChange={(e) => setPrTitleTemplate(e.target.value)}
                style={styles.input}
              />
              <label style={styles.fieldLabel}>body template (optional)</label>
              <textarea
                placeholder="Closes {taskId}\n\n..."
                value={prBodyTemplate}
                onChange={(e) => setPrBodyTemplate(e.target.value)}
                style={{ ...styles.input, minHeight: '60px', fontFamily: 'var(--font-mono)' }}
              />
            </>
          )}
        </div>
      )}

      <div style={styles.actions}>
        <button type="button" onClick={onClose} style={styles.cancelButton}>
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
  select: {
    padding: '6px 0',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
    width: '100%',
  },
  advancedToggle: {
    marginTop: '4px',
    padding: '4px 0',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    textAlign: 'left',
  },
  advancedSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    paddingTop: '8px',
    borderTop: '1px dashed var(--border-input)',
  },
  sectionLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  fieldLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    marginTop: '6px',
  },
  helpText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  urlList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  urlRow: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  removeButton: {
    width: '24px',
    height: '24px',
    padding: 0,
    backgroundColor: 'transparent',
    color: 'var(--state-error)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-mono)',
  },
  addUrlButton: {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
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
