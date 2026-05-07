import React from 'react';
import { PoChatMessage as PoChatMessageType } from '../../store/poChatStore';

interface PoChatMessageProps {
  message: PoChatMessageType;
  isStreaming?: boolean;
}

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - Date.parse(timestamp);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export const PoChatMessage: React.FC<PoChatMessageProps> = ({ message, isStreaming }) => {
  const isUser = message.role === 'user';

  return (
    <div style={isUser ? styles.userRow : styles.assistantRow}>
      {!isUser && (
        <div style={styles.avatar}>PO</div>
      )}
      <div style={{ maxWidth: '75%' }}>
        <div style={isUser ? styles.userBubble : styles.assistantBubble}>
          <span style={styles.content}>{message.content}</span>
          {isStreaming && <span style={styles.cursor}>▊</span>}
        </div>
        <div style={isUser ? styles.userMeta : styles.assistantMeta}>
          {formatRelativeTime(message.timestamp)}
        </div>
      </div>
      {isUser && (
        <div style={styles.userAvatar}>You</div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  assistantRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    fontFamily: 'var(--font-mono)',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 700,
    flexShrink: 0,
    border: '1px solid var(--border-color)',
    fontFamily: 'var(--font-mono)',
  },
  userBubble: {
    backgroundColor: 'var(--brand-primary)',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: '12px 12px 2px 12px',
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  assistantBubble: {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    padding: '8px 12px',
    borderRadius: '2px 12px 12px 12px',
    fontSize: 13,
    lineHeight: 1.5,
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  content: {
    display: 'inline',
  },
  cursor: {
    display: 'inline',
    opacity: 1,
    animation: 'blink 1s step-end infinite',
    marginLeft: 2,
    color: 'var(--brand-primary)',
  },
  userMeta: {
    textAlign: 'right',
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 3,
    paddingRight: 4,
  },
  assistantMeta: {
    textAlign: 'left',
    fontSize: 10,
    color: 'var(--text-muted)',
    marginTop: 3,
    paddingLeft: 4,
  },
};
