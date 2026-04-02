import React, { useEffect, useRef } from 'react';
import {
  AgentRole,
  AgentMessage,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  useStore,
} from '../../store/sessionStore';
import { AgentStatusBadge } from './AgentStatusBadge';

interface AgentTabProps {
  role: AgentRole;
  subtaskId?: string;
  agentId?: string;
}

export const AgentTab: React.FC<AgentTabProps> = ({ role }) => {
  const messages = useStore((s) => s.agentOutputs[role]);
  const agents = useStore((s) => s.agents);
  const agent = agents.find((a) => a.role === role);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [messages]);

  const status = agent?.status || 'idle';
  const tokens = agent?.tokensUsed || { input: 0, output: 0 };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.roleInfo}>
          <div
            style={{
              ...styles.roleIndicator,
              backgroundColor: ROLE_COLORS[role],
            }}
          />
          <span style={styles.roleName}>{ROLE_DISPLAY_NAMES[role]}</span>
          <AgentStatusBadge status={status} />
        </div>
        {(tokens.input > 0 || tokens.output > 0) && (
          <span style={styles.tokens}>
            {tokens.input + tokens.output} tokens
          </span>
        )}
      </div>

      <div ref={outputRef} style={styles.output}>
        {messages.length === 0 ? (
          <div style={styles.empty}>
            {status === 'idle'
              ? 'Waiting for assignment...'
              : status === 'running'
              ? 'Agent started, waiting for output...'
              : 'No output'}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.line,
                color: msg.type === 'stderr' ? '#ff4500' : '#e8dcc8',
              }}
            >
              {formatOutput(msg.content)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * Try to format JSON output nicely, otherwise return raw text.
 */
function formatOutput(content: string): string {
  try {
    const data = JSON.parse(content);
    // Claude CLI stream-json format
    if (data.type === 'assistant' && data.message?.content) {
      return data.message.content
        .map((block: any) => block.text || '')
        .filter(Boolean)
        .join('\n');
    }
    if (data.type === 'result' && data.result) {
      return data.result;
    }
    if (data.content) {
      return typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    }
    return content;
  } catch {
    return content;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    padding: '8px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
    backgroundColor: 'rgba(10, 10, 20, 0.5)',
    flexShrink: 0,
  },
  roleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  roleIndicator: {
    width: 10,
    height: 10,
    borderRadius: '50%',
  },
  roleName: {
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    color: '#ffd700',
  },
  tokens: {
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: '#ffd700',
  },
  output: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    fontFamily: 'var(--font-typewriter)',
    fontSize: 12,
    lineHeight: 1.6,
    backgroundColor: '#050505',
    color: '#e8dcc8',
  },
  empty: {
    color: '#5c5470',
    fontStyle: 'italic',
    fontSize: 12,
  },
  line: {
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    marginBottom: 2,
  },
};
