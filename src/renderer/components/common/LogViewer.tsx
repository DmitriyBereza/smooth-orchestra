import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/sessionStore';

const EVENT_COLORS: Record<string, string> = {
  system:   'var(--text-muted)',
  session:  'var(--role-po)',
  agent:    'var(--role-developer)',
  artifact: 'var(--state-success)',
  git:      'var(--role-techlead)',
  lock:     'var(--text-secondary)',
  error:    'var(--state-error)',
};

function relativeTime(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const LogViewer: React.FC<{ forceExpanded?: boolean }> = ({ forceExpanded }) => {
  const events = useStore((s) => s.events);
  const filters = useStore((s) => s.eventFilters);
  const setEventFilter = useStore((s) => s.setEventFilter);
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [events]);

  const filteredEvents = events.filter((event) => {
    if (filters.category && event.type !== filters.category) return false;
    if (filters.search && !event.message.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.role && !event.message.toLowerCase().includes(filters.role)) return false;
    return true;
  });

  return (
    <div style={{ ...styles.container, height: forceExpanded ? '100%' : isExpanded ? 250 : 32 }}>
      {!forceExpanded && (
        <div
          style={styles.header}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span style={styles.title}>
            event log ({filteredEvents.length}/{events.length})
          </span>
          <span style={styles.toggle}>{isExpanded ? '▼' : '▲'}</span>
        </div>
      )}

      {(forceExpanded || isExpanded) && (
        <>
          <div style={styles.filterBar}>
            <select
              value={filters.category || ''}
              onChange={(e) => setEventFilter({ category: e.target.value || null })}
              style={styles.filterSelect}
            >
              <option value="">all types</option>
              <option value="session">session</option>
              <option value="agent">agent</option>
              <option value="artifact">artifact</option>
              <option value="git">git</option>
              <option value="lock">lock</option>
              <option value="error">error</option>
            </select>

            <select
              value={filters.role || ''}
              onChange={(e) => setEventFilter({ role: e.target.value || null })}
              style={styles.filterSelect}
            >
              <option value="">all roles</option>
              <option value="po">product owner</option>
              <option value="architect">architect</option>
              <option value="tech-lead">tech lead</option>
              <option value="developer">developer</option>
              <option value="qa">qa engineer</option>
            </select>

            <input
              type="text"
              placeholder="> search events_"
              value={filters.search}
              onChange={(e) => setEventFilter({ search: e.target.value })}
              style={styles.searchInput}
            />
          </div>

          <div ref={listRef} style={styles.list}>
            {filteredEvents.length === 0 ? (
              <div style={styles.empty}>{'> awaiting task'}<span className="signal-cursor-blink" style={{ marginLeft: '2px' }}>_</span></div>
            ) : (
              filteredEvents.map((event, i) => (
                <div key={i} style={styles.event}>
                  <span
                    style={styles.timestamp}
                    title={new Date(event.timestamp).toLocaleString()}
                  >
                    {relativeTime(event.timestamp)}
                  </span>
                  <span
                    style={{
                      ...styles.typeBadge,
                      color: EVENT_COLORS[event.type] || 'var(--text-secondary)',
                    }}
                  >
                    [{event.type}]
                  </span>
                  <span style={styles.message}>{event.message}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  },
  header: {
    padding: '6px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
  },
  title: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  toggle: {
    fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    padding: '4px 16px',
    borderBottom: '1px solid var(--border-color)',
    alignItems: 'center',
    flexShrink: 0,
  },
  filterSelect: {
    padding: '2px 6px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
  },
  searchInput: {
    padding: '2px 8px',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-input)',
    borderRadius: 'var(--radius-sm)',
    outline: 'none',
    flex: 1,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    lineHeight: 1.8,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-muted)',
    padding: '8px 0',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
  },
  event: {
    display: 'flex',
    gap: '8px',
    alignItems: 'baseline',
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    flexShrink: 0,
  },
  typeBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    flexShrink: 0,
  },
  message: {
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    wordBreak: 'break-word' as const,
  },
};
