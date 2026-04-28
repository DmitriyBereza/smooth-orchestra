import React, { useEffect, useRef, useState, useCallback } from 'react';
import { usePoChatStore } from '../../store/poChatStore';
import { usePoChatCommands } from '../../hooks/useSocket';
import { useProjectStore } from '../../store/projectStore';
import { PoChatMessage } from './PoChatMessage';

interface PoChatPanelProps {
  onClose: () => void;
}

export const PoChatPanel: React.FC<PoChatPanelProps> = ({ onClose }) => {
  const { messages, streamingContent, streamingMessageId, isLoading, error } = usePoChatStore();
  const { addUserMessage, clearError, reset } = usePoChatStore();
  const { sendMessage, loadHistory, clearChat } = usePoChatCommands();
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load history when panel opens or project changes
  useEffect(() => {
    if (selectedProjectId) {
      loadHistory(selectedProjectId);
    }
  }, [selectedProjectId]);

  // Auto-scroll to bottom on new messages / chunks
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || isLoading || !selectedProjectId) return;
    const text = inputText.trim();
    setInputText('');
    addUserMessage(text);
    sendMessage(selectedProjectId, text);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputText, isLoading, selectedProjectId, addUserMessage, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    // Auto-grow textarea (max 4 rows ≈ 88px)
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 88)}px`;
  };

  const handleClear = () => {
    if (!selectedProjectId) return;
    clearChat(selectedProjectId);
    reset();
  };

  const hasStreamingMessage = streamingContent.length > 0 && streamingMessageId !== null;

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerAvatar}>PO</div>
          <div>
            <div style={styles.headerTitle}>Ask Product Owner</div>
            <div style={styles.headerSubtitle}>
              {selectedProjectId ? 'Ask anything about this project' : 'Select a project first'}
            </div>
          </div>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.clearButton}
            onClick={handleClear}
            title="Clear chat"
            disabled={messages.length === 0 && !hasStreamingMessage}
          >
            Clear
          </button>
          <button style={styles.closeButton} onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.errorDismiss} onClick={clearError}>✕</button>
        </div>
      )}

      {/* Message list */}
      <div style={styles.messageList}>
        {messages.length === 0 && !hasStreamingMessage && !isLoading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <div style={styles.emptyTitle}>Ask the Product Owner</div>
            <div style={styles.emptySubtitle}>
              Get answers about this project's functionality, architecture, and requirements.
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <PoChatMessage key={msg.id} message={msg} />
        ))}

        {/* Streaming message */}
        {hasStreamingMessage && (
          <PoChatMessage
            key="streaming"
            message={{
              id: streamingMessageId!,
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date().toISOString(),
            }}
            isStreaming
          />
        )}

        {/* Loading indicator (when agent is thinking but hasn't streamed yet) */}
        {isLoading && !hasStreamingMessage && (
          <div style={styles.thinkingRow}>
            <div style={styles.thinkingAvatar}>PO</div>
            <div style={styles.thinkingBubble}>
              <span style={styles.thinkingDot} />
              <span style={styles.thinkingDot} />
              <span style={styles.thinkingDot} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          ref={textareaRef}
          style={{
            ...styles.textarea,
            opacity: isLoading || !selectedProjectId ? 0.6 : 1,
          }}
          value={inputText}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={
            !selectedProjectId
              ? 'Select a project to start chatting…'
              : isLoading
                ? 'Waiting for response…'
                : 'Ask the PO a question… (Enter to send, Shift+Enter for newline)'
          }
          disabled={isLoading || !selectedProjectId}
          rows={1}
        />
        <button
          style={{
            ...styles.sendButton,
            opacity: !inputText.trim() || isLoading || !selectedProjectId ? 0.5 : 1,
            cursor: !inputText.trim() || isLoading || !selectedProjectId ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSend}
          disabled={!inputText.trim() || isLoading || !selectedProjectId}
          title="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-color)',
    flexShrink: 0,
    backgroundColor: 'var(--bg-secondary)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#3B82F6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerSubtitle: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    padding: '4px 10px',
    fontSize: 12,
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
  },
  closeButton: {
    padding: '4px 8px',
    fontSize: 14,
    border: 'none',
    borderRadius: 4,
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: '#fee2e2',
    borderBottom: '1px solid #fca5a5',
    flexShrink: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#991b1b',
    flex: 1,
  },
  errorDismiss: {
    border: 'none',
    background: 'none',
    color: '#991b1b',
    cursor: 'pointer',
    fontSize: 12,
    padding: '0 0 0 8px',
  },
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.5,
    maxWidth: 260,
  },
  thinkingRow: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  thinkingAvatar: {
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
  thinkingBubble: {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    padding: '12px 16px',
    borderRadius: '2px 12px 12px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'var(--text-muted)',
    display: 'inline-block',
    animation: 'bounce 1.2s ease-in-out infinite',
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--border-color)',
    flexShrink: 0,
    backgroundColor: 'var(--bg-secondary)',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontFamily: 'var(--font-body)',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    outline: 'none',
    lineHeight: 1.5,
    overflow: 'hidden',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#3B82F6',
    color: '#fff',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    lineHeight: 1,
  },
};
