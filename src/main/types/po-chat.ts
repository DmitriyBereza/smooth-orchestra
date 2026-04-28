/**
 * Types for the PO chat feature.
 * Project-scoped multi-turn conversation with the Product Owner agent.
 */

export interface PoChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO-8601
}

export interface PoChatResponseEvent {
  projectId: string;
  content: string;
  messageId: string;
  done: boolean;
}

export interface PoChatCommandPayload {
  projectId: string;
  message: string;
}

export interface PoChatHistoryPayload {
  projectId: string;
}
