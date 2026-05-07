import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

export interface PoChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO-8601
}

interface PoChatState {
  /** Messages for the active project */
  messages: PoChatMessage[];
  /** Content being streamed (not yet finalised as a full message) */
  streamingContent: string;
  /** ID of the message currently being streamed */
  streamingMessageId: string | null;
  /** True while the agent is processing a request */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
  /** The project whose history is loaded */
  activeProjectId: string | null;

  // ── Actions ──────────────────────────────────────────────────────────────
  addUserMessage: (content: string) => void;
  appendStreamChunk: (content: string, messageId: string) => void;
  finalizeStream: (messageId: string) => void;
  setHistory: (projectId: string, messages: PoChatMessage[]) => void;
  setBusy: () => void;
  setError: (error: string) => void;
  clearError: () => void;
  reset: () => void;
}

export const usePoChatStore = create<PoChatState>((set, get) => ({
  messages: [],
  streamingContent: '',
  streamingMessageId: null,
  isLoading: false,
  error: null,
  activeProjectId: null,

  addUserMessage: (content: string) => {
    const msg: PoChatMessage = {
      id: uuid(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      messages: [...state.messages, msg],
      isLoading: true,
      error: null,
    }));
  },

  appendStreamChunk: (content: string, messageId: string) => {
    set((state) => ({
      streamingContent: state.streamingContent + content,
      streamingMessageId: messageId,
    }));
  },

  finalizeStream: (messageId: string) => {
    const { streamingContent } = get();
    const finalMsg: PoChatMessage = {
      id: messageId,
      role: 'assistant',
      content: streamingContent,
      timestamp: new Date().toISOString(),
    };
    set((state) => ({
      messages: streamingContent
        ? [...state.messages, finalMsg]
        : state.messages,
      streamingContent: '',
      streamingMessageId: null,
      isLoading: false,
    }));
  },

  setHistory: (projectId: string, messages: PoChatMessage[]) => {
    set({
      activeProjectId: projectId,
      messages,
      streamingContent: '',
      streamingMessageId: null,
      isLoading: false,
      error: null,
    });
  },

  setBusy: () => {
    set({ isLoading: true });
  },

  setError: (error: string) => {
    set({ error, isLoading: false, streamingContent: '', streamingMessageId: null });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set({
      messages: [],
      streamingContent: '',
      streamingMessageId: null,
      isLoading: false,
      error: null,
    });
  },
}));
