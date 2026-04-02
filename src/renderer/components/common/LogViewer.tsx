import React, { useRef, useEffect, useState } from 'react';
import { useStore } from '../../store/sessionStore';

const EVENT_COLORS: Record<string, string> = {
  system: '#5c5470',
  session: '#ffd700',
  agent: '#9b59b6',
  artifact: '#ffd700',
  git: '#ff4500',
  lock: '#a0937d',
  error: '#ff4500',
};

export const LogViewer: React.FC = () => {
  const events = useStore((s) => s.events);
  const [isExpanded, setIsExpanded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0; // Events are prepended, newest first
    }
  }, [events]);

  return (
    <div style={{ ...styles.container, height: isExpanded ? 200 : 32 }}>
      <div
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={styles.title}>
          EVENT LOG ({events.length})
        </span>
        <span style={styles.toggle}>{isExpanded ? '\u25BC' : '\u25B2'}</span>
      </div>

      {isExpanded && (
        <div ref={listRef} style={styles.list}>
          {events.length === 0 ? (
            <div style={styles.empty}>No events yet</div>
          ) : (
            events.map((event, i) => (
              <div key={i} style={styles.event}>
                <span style={styles.timestamp}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    ...styles.typeBadge,
                    color: EVENT_COLORS[event.type] || 'var(--text-secondary)',
                    textShadow: `0 0 3px ${EVENT_COLORS[event.type] || 'var(--text-secondary)'}`,
                  }}
                >
                  [{event.type}]
                </span>
                <span style={styles.message}>{event.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: '#0a0a14',
    border: '1px solid rgba(155, 89, 182, 0.15)',
    borderTop: '1px solid rgba(155, 89, 182, 0.25)',
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
    borderBottom: '1px solid rgba(155, 89, 182, 0.1)',
    flexShrink: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: '#9b59b6',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.15em',
    textShadow: '0 0 5px #9b59b6',
  },
  toggle: {
    fontSize: 10,
    color: '#9b59b6',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 16px',
    fontFamily: 'var(--font-typewriter)',
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
    color: '#5c5470',
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
  },
  typeBadge: {
    fontWeight: 600,
    flexShrink: 0,
  },
  message: {
    color: '#a0937d',
    wordBreak: 'break-word' as const,
  },
};
