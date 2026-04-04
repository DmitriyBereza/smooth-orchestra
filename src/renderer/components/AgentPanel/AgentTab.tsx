import React, { useEffect, useRef } from 'react';
import {
  AgentRole,
  AgentMessage,
  ROLE_DISPLAY_NAMES,
  ROLE_COLORS,
  useStore,
} from '../../store/sessionStore';
import { AgentStatusBadge } from './AgentStatusBadge';
import { ROLE_COLOR } from '../../utils/roleColors';

interface AgentTabProps {
  role: AgentRole;
  subtaskId?: string;
  agentId?: string;
}

const EVENT_TAG_COLOR: Record<string, string> = {
  agent:    'var(--role-developer)',
  artifact: 'var(--state-success)',
  system:   'var(--text-muted)',
  session:  'var(--role-po)',
  git:      'var(--role-techlead)',
  error:    'var(--state-error)',
};

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
  const roleColor = ROLE_COLOR[role] || ROLE_COLORS[role] || 'var(--brand-primary)';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.roleInfo}>
          {/* 8px circle dot instead of square */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: roleColor,
              flexShrink: 0,
            }}
          />
          <span style={{ ...styles.roleName, color: roleColor }}>{ROLE_DISPLAY_NAMES[role]}</span>
          <AgentStatusBadge status={status} role={role} />
        </div>
        {(tokens.input > 0 || tokens.output > 0) && (
          <span style={styles.tokens}>
            {(tokens.input + tokens.output).toLocaleString()} tokens
          </span>
        )}
      </div>

      <div ref={outputRef} style={styles.output}>
        {messages.length === 0 ? (
          <div style={styles.empty}>
            {'> awaiting task'}
            <span className="signal-cursor-blink" style={{ marginLeft: '2px' }}>_</span>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={styles.line}>
              <span style={styles.timestamp}>
                {new Date(msg.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span style={{ ...styles.tag, color: EVENT_TAG_COLOR[msg.type] || 'var(--text-secondary)' }}>
                [{msg.type}]
              </span>
              <span style={{ color: msg.type === 'stderr' ? 'var(--state-error)' : 'var(--text-secondary)' }}>
                {formatOutput(msg.content)}
              </span>
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
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    background: 'var(--bg-secondary)',
  },
  roleInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  roleName: {
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'var(--font-mono)',
  },
  tokens: {
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  output: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-base)',
    lineHeight: 1.4,
    color: 'var(--text-secondary)',
    backgroundColor: 'var(--bg-primary)',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-muted)',
  },
  line: {
    display: 'flex',
    alignItems: 'baseline',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    marginBottom: '2px',
  },
  timestamp: {
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    flexShrink: 0,
    marginRight: '6px',
  },
  tag: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    flexShrink: 0,
    marginRight: '6px',
  },
};
