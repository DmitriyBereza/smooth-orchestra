/**
 * AgentBackend — Abstraction layer for AI agent backends.
 *
 * This interface allows Smooth Orchestra to support multiple agent engines
 * (Claude Code CLI, Cursor Composer, etc.) via a common contract.
 *
 * Each backend wraps a specific agent runtime and normalises its lifecycle,
 * output streaming, and session management into a uniform API that
 * SessionManager and AgentPool can consume without knowing the underlying tool.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options passed when spawning a new agent process. */
export interface AgentSpawnOptions {
  /** The task-specific prompt (what to do). */
  taskPrompt: string;
  /** The system-level prompt (who you are). */
  systemPrompt: string;
  /** Working directory the agent should operate in. */
  workingDirectory: string;
  /** Optional model override (e.g. "claude-sonnet-4-20250514", "composer-2.5"). */
  model?: string;
}

/** Cumulative token usage reported by the backend. */
export interface AgentTokenUsage {
  input: number;
  output: number;
}

/** Declares what the backend can and cannot do. */
export interface BackendCapabilities {
  /** Can the backend resume a prior session by ID? */
  supportsSessionResume: boolean;
  /** Does the backend emit streaming NDJSON events? */
  supportsStreamingJson: boolean;
  /** Can a system prompt be injected via a CLI flag (not just rule files)? */
  supportsSystemPrompt: boolean;
  /** Can the backend limit the number of agentic turns? */
  supportsMaxTurns: boolean;
  /** Does the backend support a "skip all permission prompts" flag? */
  supportsDangerousPermissions: boolean;
  /** Does the backend support MCP server integration? */
  supportsMcp: boolean;
}

/** Event signatures emitted by every backend. */
export interface AgentBackendEvents {
  /** A line of output was produced. */
  output: (content: string, type: 'stdout' | 'stderr') => void;
  /** The underlying process exited. */
  exited: (code: number, signal: string | null) => void;
  /** The backend detected a rate/usage limit. */
  rateLimited: (message: string, retryMs: number) => void;
  /** The agent exhausted its turn budget (needs resume). */
  maxTurnsReached: (sessionId: string) => void;
}

/** Backend type discriminator used in configuration. */
export type AgentBackendType = 'claude-cli' | 'cursor-cli' | 'cursor-sdk';

/** Configuration blob stored in the orchestra config / project settings. */
export interface AgentBackendConfig {
  type: AgentBackendType;
  /** API key for backends that need one (e.g. Cursor SDK). */
  apiKey?: string;
  /** Extra options — backends may define their own. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Minimal contract every agent backend must satisfy.
 *
 * Design rationale:
 *  - `spawn` / `resume` / `kill` mirror the existing AgentProcess lifecycle.
 *  - Readonly properties (`status`, `sessionId`, `tokensUsed`) let callers
 *    inspect state without mutation.
 *  - Event methods follow Node EventEmitter semantics (on/off) rather than
 *    requiring inheritance — keeps backends free to use any internal wiring.
 */
export interface AgentBackend {
  /** Human-readable backend identifier (e.g. "claude-cli", "cursor-cli"). */
  readonly name: string;

  /** Current lifecycle status. */
  readonly status: 'idle' | 'running' | 'completed' | 'failed' | 'killed';

  /** Session/chat ID captured from the backend's output (null until available). */
  readonly sessionId: string | null;

  /** Cumulative token usage. */
  readonly tokensUsed: AgentTokenUsage;

  /** Declare what this backend supports so callers can adapt. */
  capabilities(): BackendCapabilities;

  /** Spawn a new agent run. Rejects if already running. */
  spawn(options: AgentSpawnOptions): Promise<void>;

  /** Resume a previous session. Rejects if already running. */
  resume(sessionId: string): Promise<void>;

  /** Kill the running process (graceful then forced). */
  kill(): void;

  /** Subscribe to a backend event. */
  on<E extends keyof AgentBackendEvents>(
    event: E,
    handler: AgentBackendEvents[E],
  ): void;

  /** Unsubscribe from a backend event. */
  off<E extends keyof AgentBackendEvents>(
    event: E,
    handler: AgentBackendEvents[E],
  ): void;
}
