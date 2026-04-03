import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/sessionStore';

const EVENT_COLORS: Record<string, string> = {
  system: 'var(--text-muted)',
  session: 'var(--accent-blue)',
  agent: 'var(--accent-purple)',
  artifact: 'var(--accent-green)',
  git: 'var(--accent-orange)',
  lock: 'var(--text-secondary)',
  error: 'var(--accent-red)',
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
      listRef.current.scrollTop = 0; // Events are prepended, newest first
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
            Event Log ({filteredEvents.length}/{events.length})
          </span>
          <span style={styles.toggle}>{isExpanded ? '\u25BC' : '\u25B2'}</span>
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
              <option value="">All Types</option>
              <option value="session">Session</option>
              <option value="agent">Agent</option>
              <option value="artifact">Artifact</option>
              <option value="git">Git</option>
              <option value="lock">Lock</option>
              <option value="error">Error</option>
            </select>

            <select
              value={filters.role || ''}
              onChange={(e) => setEventFilter({ role: e.target.value || null })}
              style={styles.filterSelect}
            >
              <option value="">All Roles</option>
              <option value="po">Product Owner</option>
              <option value="architect">Architect</option>
              <option value="tech-lead">Tech Lead</option>
              <option value="developer">Developer</option>
              <option value="qa">QA Engineer</option>
            </select>

            <input
              type="text"
              placeholder="Search events..."
              value={filters.search}
              onChange={(e) => setEventFilter({ search: e.target.value })}
              style={styles.searchInput}
            />
          </div>

          <div ref={listRef} style={styles.list}>
            {filteredEvents.length === 0 ? (
              <div style={styles.empty}>No events yet</div>
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
    transition: 'height 0.2s ease',
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
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  toggle: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  filterBar: {
    display: 'flex',
    gap: 8,
    padding: '4px 16px',
    borderBottom: '1px solid var(--border-color)',
    alignItems: 'center',
    flexShrink: 0,
  },
  filterSelect: {
    padding: '2px 6px',
    fontSize: 11,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    outline: 'none',
  },
  searchInput: {
    padding: '2px 8px',
    fontSize: 11,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 3,
    outline: 'none',
    flex: 1,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 16px',
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    lineHeight: 1.8,
  },
  empty: {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    padding: '8px 0',
  },
  event: {
    display: 'flex',
    gap: 8,
    alignItems: 'baseline',
  },
  timestamp: {
    color: 'var(--text-muted)',
    flexShrink: 0,
  },
  typeBadge: {
    fontWeight: 600,
    flexShrink: 0,
  },
  message: {
    color: 'var(--text-secondary)',
    wordBreak: 'break-word' as const,
  },
};
