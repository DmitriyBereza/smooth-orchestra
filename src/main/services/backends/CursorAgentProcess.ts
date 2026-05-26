/**
 * CursorAgentProcess — Agent backend adapter for Cursor CLI.
 *
 * Wraps the `cursor agent` CLI command to provide the same lifecycle
 * semantics as the existing Claude Code CLI integration. Uses the
 * AgentBackend interface so SessionManager/AgentPool can treat it
 * interchangeably with ClaudeCliBackend.
 *
 * Key differences from Claude CLI:
 *  - Binary: `cursor` (sub-command `agent`)
 *  - System prompt: injected via .cursor/rules/ files, NOT a CLI flag
 *  - No --max-turns or --dangerously-skip-permissions equivalents
 *  - Session resume via `--resume <chatId>`
 *  - Auth via CURSOR_API_KEY env var
 *  - MCP support via .cursor/mcp.json
 */

import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import type {
  AgentBackend,
  AgentBackendEvents,
  AgentSpawnOptions,
  AgentTokenUsage,
  BackendCapabilities,
} from './AgentBackend';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface CursorBackendOptions {
  /** Cursor API key for headless auth. Falls back to CURSOR_API_KEY env. */
  apiKey?: string;
  /** Override the binary name (default: "cursor"). */
  binary?: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class CursorAgentProcess implements AgentBackend {
  readonly name = 'cursor-cli' as const;

  private _status: AgentBackend['status'] = 'idle';
  private _sessionId: string | null = null;
  private _tokens: AgentTokenUsage = { input: 0, output: 0 };
  private process: ChildProcess | null = null;
  private listeners = new Map<string, Set<(...args: any[]) => void>>();
  private readonly binary: string;
  private readonly apiKey?: string;

  constructor(options?: CursorBackendOptions) {
    this.binary = options?.binary ?? 'cursor';
    this.apiKey = options?.apiKey;
  }

  // ---- Readonly accessors --------------------------------------------------

  get status(): AgentBackend['status'] {
    return this._status;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  get tokensUsed(): AgentTokenUsage {
    return { ...this._tokens };
  }

  // ---- Capabilities --------------------------------------------------------

  capabilities(): BackendCapabilities {
    return {
      supportsSessionResume: true,
      supportsStreamingJson: true,
      // Cursor uses .cursor/rules/ directory instead of --system-prompt flag
      supportsSystemPrompt: false,
      // No --max-turns equivalent in Cursor CLI
      supportsMaxTurns: false,
      // No --dangerously-skip-permissions equivalent
      supportsDangerousPermissions: false,
      // Cursor supports MCP via .cursor/mcp.json
      supportsMcp: true,
    };
  }

  // ---- Lifecycle -----------------------------------------------------------

  async spawn(options: AgentSpawnOptions): Promise<void> {
    if (this._status === 'running') {
      throw new Error(`CursorAgentProcess is already running`);
    }

    const args = [
      'agent',
      '-p', options.taskPrompt,
      '--output-format', 'stream-json',
      '--force',
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

    this.spawnProcess(args, options.workingDirectory);
  }

  async resume(sessionId: string): Promise<void> {
    if (this._status === 'running') {
      throw new Error(`CursorAgentProcess is already running`);
    }

    this._sessionId = sessionId;

    const args = [
      'agent',
      '--resume', sessionId,
      '--output-format', 'stream-json',
      '--force',
    ];

    this.spawnProcess(args);
  }

  kill(): void {
    if (this.process && this._status === 'running') {
      this._status = 'killed';
      this.process.kill('SIGTERM');

      // Force-kill after 5 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
    }
  }

  // ---- Events --------------------------------------------------------------

  on<E extends keyof AgentBackendEvents>(
    event: E,
    handler: AgentBackendEvents[E],
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off<E extends keyof AgentBackendEvents>(
    event: E,
    handler: AgentBackendEvents[E],
  ): void {
    this.listeners.get(event)?.delete(handler);
  }

  // ---- Private -------------------------------------------------------------

  private emit<E extends keyof AgentBackendEvents>(
    event: E,
    ...args: Parameters<AgentBackendEvents[E]>
  ): void {
    this.listeners.get(event)?.forEach((fn) => (fn as any)(...args));
  }

  private spawnProcess(args: string[], cwd?: string): void {
    const env: Record<string, string | undefined> = { ...process.env };
    if (this.apiKey) {
      env.CURSOR_API_KEY = this.apiKey;
    }

    this.process = spawn(this.binary, args, {
      cwd: cwd ?? process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    this._status = 'running';

    // Stream stdout
    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line) => this.handleLine(line, 'stdout'));
    }

    // Stream stderr
    if (this.process.stderr) {
      const rl = createInterface({ input: this.process.stderr });
      rl.on('line', (line) => this.handleLine(line, 'stderr'));
    }

    // Process exit
    this.process.on('exit', (code, signal) => {
      const exitCode = code ?? (signal ? 1 : 0);
      this._status = exitCode === 0 ? 'completed' : 'failed';
      this.process = null;
      this.emit('exited', exitCode, signal ?? null);
    });

    // Process error (e.g. binary not found)
    this.process.on('error', (err) => {
      this._status = 'failed';
      this.emit('output', `Process error: ${err.message}`, 'stderr');
      this.emit('exited', 1, null);
    });
  }

  private handleLine(line: string, type: 'stdout' | 'stderr'): void {
    this.emit('output', line, type);

    try {
      const data = JSON.parse(line);

      // Session ID from result event
      if (data.type === 'result' && data.session_id) {
        this._sessionId = data.session_id as string;
      }

      // Token usage
      if (data.usage) {
        if (data.usage.input_tokens) this._tokens.input += data.usage.input_tokens;
        if (data.usage.output_tokens) this._tokens.output += data.usage.output_tokens;
      }

      // Rate limit detection
      if (data.error?.type === 'rate_limit_error' || data.error?.type === 'overloaded_error') {
        const msg = data.error?.message ?? `API error: ${data.error.type}`;
        this.emit('rateLimited', msg, 5 * 60_000);
      }

      // Max turns (if Cursor ever supports it — forward compatible)
      if (data.subtype === 'error_max_turns' && this._sessionId) {
        this.emit('maxTurnsReached', this._sessionId);
      }
    } catch {
      // Not JSON — ignore
    }
  }
}
