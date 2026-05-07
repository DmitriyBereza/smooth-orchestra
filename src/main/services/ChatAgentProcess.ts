import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';

/**
 * Callback invoked for each streamed text chunk from the Claude CLI.
 * @param content  The text content chunk
 * @param done     true when the agent has finished responding
 */
export type ChunkCallback = (content: string, done: boolean) => void;

/**
 * Callback invoked when an error occurs (crash, timeout, etc.)
 */
export type ErrorCallback = (error: string) => void;

/**
 * Lightweight Claude CLI wrapper tailored for chat interactions.
 *
 * Unlike AgentProcess, this class:
 * - Does NOT require AgentRole or taskId
 * - Does NOT emit EventBus events (the caller handles that)
 * - Parses streaming JSON to extract text content chunks
 * - Supports --resume sessionId for multi-turn conversations
 * - Enforces a configurable timeout to prevent stalled processes
 */
export class ChatAgentProcess {
  public busy = false;
  public lastSessionId: string | null = null;

  private process: ChildProcess | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly timeoutMs: number;

  constructor(
    private readonly projectPath: string,
    timeoutMs = 5 * 60 * 1000, // 5-minute default
  ) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Start a fresh Claude CLI session with the given message and system prompt.
   */
  async start(
    message: string,
    systemPrompt: string,
    onChunk: ChunkCallback,
    onError: ErrorCallback,
  ): Promise<void> {
    if (this.busy) {
      throw new Error('ChatAgentProcess is already running');
    }

    const args = [
      '-p', message,
      '--system-prompt', systemPrompt,
      '--output-format', 'stream-json',
      '--max-turns', '50',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    this.spawnProcess(args, onChunk, onError);
  }

  /**
   * Resume an existing Claude CLI session with a new message.
   */
  async resume(
    sessionId: string,
    message: string,
    onChunk: ChunkCallback,
    onError: ErrorCallback,
  ): Promise<void> {
    if (this.busy) {
      throw new Error('ChatAgentProcess is already running');
    }

    const args = [
      '--resume', sessionId,
      '-p', message,
      '--output-format', 'stream-json',
      '--max-turns', '50',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    this.spawnProcess(args, onChunk, onError);
  }

  /**
   * Kill the running process (SIGTERM + SIGKILL fallback after 5s).
   */
  kill(): void {
    this.clearTimeout();
    if (this.process) {
      this.process.kill('SIGTERM');
      const proc = this.process;
      setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000);
      this.process = null;
    }
    this.busy = false;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private spawnProcess(args: string[], onChunk: ChunkCallback, onError: ErrorCallback): void {
    this.busy = true;

    this.process = spawn('claude', args, {
      cwd: this.projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    // Set up the inactivity timeout
    this.resetTimeout(onChunk, onError);

    // Stream stdout line-by-line
    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line) => {
        this.resetTimeout(onChunk, onError);
        this.handleLine(line, onChunk);
      });
    }

    // Stream stderr (log only, not fatal)
    if (this.process.stderr) {
      const rl = createInterface({ input: this.process.stderr });
      rl.on('line', (line) => {
        console.warn('[ChatAgentProcess] stderr:', line);
      });
    }

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      this.clearTimeout();
      this.process = null;
      this.busy = false;

      if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
        onError(`Agent process exited with code ${code ?? signal}`);
      } else {
        // Emit a final done=true chunk so the caller knows streaming ended
        onChunk('', true);
      }
    });

    this.process.on('error', (err) => {
      this.clearTimeout();
      this.process = null;
      this.busy = false;
      onError(`Agent process error: ${err.message}`);
    });
  }

  private handleLine(line: string, onChunk: ChunkCallback): void {
    try {
      const data = JSON.parse(line);

      // Capture session ID from result lines
      if (data.type === 'result' && data.session_id) {
        this.lastSessionId = data.session_id as string;
      }

      // Extract text content from assistant message blocks
      if (data.type === 'assistant' && Array.isArray(data.message?.content)) {
        for (const block of data.message.content) {
          if (block.type === 'text' && typeof block.text === 'string' && block.text) {
            onChunk(block.text, false);
          }
        }
      }
    } catch {
      // Non-JSON line — ignore (Claude CLI emits some plain text too)
    }
  }

  private resetTimeout(onChunk: ChunkCallback, onError: ErrorCallback): void {
    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      console.warn('[ChatAgentProcess] Response timed out — killing process');
      this.kill();
      onChunk('', true); // Signal done to finalise any in-progress stream
      onError('Response timed out. Please try again with a simpler question.');
    }, this.timeoutMs);
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
