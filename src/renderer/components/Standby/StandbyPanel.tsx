import React, { useEffect, useState } from 'react';
import { useStandbyStore, BacklogItem } from '../../store/standbyStore';
import { useProjectStore } from '../../store/projectStore';

const SOURCE_LABEL: Record<BacklogItem['source'], string> = {
  'feature-researcher': 'feature',
  'tech-debt-scout': 'tech-debt',
  'regression-qa': 'regression',
};

const STATUS_COLOR: Record<BacklogItem['status'], string> = {
  draft: 'var(--state-info, var(--brand-primary))',
  'auto-executed': 'var(--state-success)',
  promoted: 'var(--state-success)',
  dismissed: 'var(--text-muted)',
};

export const StandbyPanel: React.FC = () => {
  const standbyState = useStandbyStore((s) => s.state);
  const backlog = useStandbyStore((s) => s.backlog);
  const ticking = useStandbyStore((s) => s.ticking);
  const fetchStandby = useStandbyStore((s) => s.fetch);
  const toggleStandby = useStandbyStore((s) => s.toggle);
  const projects = useProjectStore((s) => s.projects);

  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    fetchStandby();
  }, [fetchStandby]);

  const enabled = standbyState?.enabled ?? false;
  const drafts = backlog.filter((b) => b.status === 'draft');
  const recent = backlog.filter((b) => b.status !== 'draft').slice(0, 5);
  const standbyTargets = projects.filter((p) => p.standby?.enabled === true);
  const noTargetsWhenOn = enabled && standbyTargets.length === 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <span style={styles.title}>standby</span>
          {ticking && <span style={styles.ticker}>● tick in progress</span>}
        </div>
        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => toggleStandby(e.target.checked)}
            style={styles.checkbox}
          />
          <span style={{ ...styles.toggleLabel, color: enabled ? 'var(--brand-primary)' : 'var(--text-muted)' }}>
            {enabled ? 'on' : 'off'}
          </span>
        </label>
      </div>

      <div style={styles.helpText}>
        {enabled
          ? `Round-robin (role × project) every minute while no task is in flight. Targets: ${standbyTargets.map((p) => p.name).join(', ') || 'none'}.`
          : 'Toggle on to let the orchestra propose ideas while you\'re away. (Default off — protects API limits.)'}
      </div>

      {noTargetsWhenOn && (
        <div style={styles.warning}>
          ⚠ standby is on but no projects are opted in. Edit a project and check "include in standby loop" to give the loop something to scan.
        </div>
      )}

      {drafts.length === 0 && recent.length === 0 ? (
        <div style={styles.empty}>{'> backlog empty'}</div>
      ) : (
        <>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionLabel}>backlog ({drafts.length})</span>
            {(drafts.length > 3 || recent.length > 0) && (
              <button onClick={() => setCollapsed((c) => !c)} style={styles.collapseButton}>
                {collapsed ? 'show all' : 'collapse'}
              </button>
            )}
          </div>
          <div style={styles.list}>
            {(collapsed ? drafts.slice(0, 3) : drafts).map((item) => (
              <BacklogCard key={item.id} item={item} />
            ))}
          </div>
          {(!collapsed || drafts.length === 0) && recent.length > 0 && (
            <>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionLabel}>recent activity</span>
              </div>
              <div style={styles.list}>
                {recent.map((item) => (
                  <BacklogCard key={item.id} item={item} compact />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

interface BacklogCardProps {
  item: BacklogItem;
  compact?: boolean;
}

const BacklogCard: React.FC<BacklogCardProps> = ({ item, compact }) => {
  const promote = useStandbyStore((s) => s.promote);
  const dismiss = useStandbyStore((s) => s.dismiss);
  const selectedProjectIds = useProjectStore((s) => s.selectedProjectIds);
  const projects = useProjectStore((s) => s.projects);

  const [expanded, setExpanded] = useState(false);
  const [pipelineType, setPipelineType] = useState<'development' | 'marketing' | 'design'>('development');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceProject = item.projectId
    ? projects.find((p) => p.id === item.projectId)
    : undefined;

  const handlePromote = async () => {
    // Prefer the item's source project; fall back to whatever the user has selected in the project list.
    const projectIds =
      item.projectId && projects.some((p) => p.id === item.projectId)
        ? [item.projectId]
        : selectedProjectIds;
    if (projectIds.length === 0) {
      setError('No source project on this item — select a project first or re-run standby.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await promote(item.id, pipelineType, projectIds);
    } catch (err: any) {
      setError(err.message ?? 'Failed to promote');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    const text = `${item.title}\n\n${item.body}`;
    void navigator.clipboard.writeText(text);
  };

  const handleDismiss = async () => {
    setBusy(true);
    try {
      await dismiss(item.id);
    } catch (err: any) {
      setError(err.message ?? 'Failed to dismiss');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        ...styles.card,
        opacity: item.status === 'dismissed' ? 0.5 : 1,
      }}
    >
      <div style={styles.cardHeader}>
        <div style={styles.cardTitleWrap}>
          <span style={{ ...styles.cardSource, borderColor: STATUS_COLOR[item.status], color: STATUS_COLOR[item.status] }}>
            {SOURCE_LABEL[item.source]}
            {item.complexity ? ` · ${item.complexity}` : ''}
            {sourceProject ? ` · ${sourceProject.name}` : item.projectName ? ` · ${item.projectName}` : ''}
          </span>
          <span style={styles.cardTitle}>{item.title}</span>
        </div>
        {!compact && item.status === 'draft' && (
          <button onClick={() => setExpanded((e) => !e)} style={styles.expandButton}>
            {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>

      {item.status !== 'draft' && item.note && (
        <div style={styles.cardNote}>{item.note}</div>
      )}
      {item.promotedTaskId && (
        <div style={styles.cardNote}>→ task {item.promotedTaskId}</div>
      )}

      {expanded && !compact && item.status === 'draft' && (
        <>
          <pre style={styles.cardBody}>{item.body}</pre>
          <div style={styles.cardActions}>
            <select
              value={pipelineType}
              onChange={(e) =>
                setPipelineType(e.target.value as 'development' | 'marketing' | 'design')
              }
              style={styles.pipelineSelect}
              disabled={busy}
            >
              <option value="development">development</option>
              <option value="marketing">marketing</option>
              <option value="design">design</option>
            </select>
            <button onClick={handlePromote} disabled={busy} style={styles.promoteButton}>
              {busy ? '…' : 'promote to pipeline'}
            </button>
            <button onClick={handleCopy} disabled={busy} style={styles.copyButton}>
              copy
            </button>
            <button onClick={handleDismiss} disabled={busy} style={styles.dismissButton}>
              dismiss
            </button>
          </div>
          {error && <div style={styles.cardError}>{error}</div>}
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-input)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  title: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  ticker: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--brand-primary)',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  checkbox: {
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
  },
  helpText: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
  },
  warning: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--state-warning, var(--state-error))',
    border: '1px dashed var(--state-warning, var(--state-error))',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 8px',
  },
  empty: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    padding: '4px 0',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  sectionLabel: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  collapseButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  card: {
    padding: '8px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '6px',
  },
  cardTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  cardSource: {
    alignSelf: 'flex-start',
    padding: '1px 6px',
    border: '1px solid',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardTitle: {
    fontSize: 'var(--text-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
  },
  cardNote: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  expandButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '0 4px',
    fontFamily: 'var(--font-mono)',
  },
  cardBody: {
    margin: '4px 0 0 0',
    padding: '8px',
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '240px',
    overflow: 'auto',
  },
  cardActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '4px',
    alignItems: 'center',
  },
  pipelineSelect: {
    padding: '4px 6px',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
  },
  promoteButton: {
    padding: '4px 10px',
    backgroundColor: 'var(--brand-primary)',
    color: 'var(--text-on-accent)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
    cursor: 'pointer',
  },
  copyButton: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  dismissButton: {
    padding: '4px 10px',
    backgroundColor: 'transparent',
    color: 'var(--state-error)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
  },
  cardError: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--state-error)',
    marginTop: '4px',
  },
};
