import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { v4 as uuid } from 'uuid';
import { AgentRole, AgentStatus, AgentMessage } from '../types';
import { eventBus } from './EventBus';

/**
 * Wraps a single Claude Code CLI child process.
 * Streams stdout/stderr and emits events through the EventBus.
 */
export class AgentProcess {
  public readonly id: string;
  public status: AgentStatus = 'idle';
  public pid: number | null = null;
  public tokensUsed = { input: 0, output: 0 };
  public rateLimited = false;
  public rateLimitRetryMs: number | null = null;
  public rateLimitMessage: string = '';
  public maxTurnsReached = false;
  public lastSessionId: string | null = null;
  public startedAt: number = 0;
  public exitedAt: number = 0;
  public lastStderrLines: string[] = [];

  private process: ChildProcess | null = null;
  private outputBuffer: string[] = [];

  private static readonly FAST_CRASH_MS = 30_000;
  private static readonly MAX_STDERR_LINES = 20;

  constructor(
    public readonly role: AgentRole,
    public readonly taskId: string,
    /** Optional subtask identifier for concurrent multi-instance agents. */
    public readonly subtaskId?: string,
  ) {
    this.id = subtaskId
      ? `${role}-${subtaskId}-${uuid().slice(0, 8)}`
      : `${role}-${uuid().slice(0, 8)}`;
  }

  /**
   * Spawn the claude CLI process with the given system prompt and task prompt.
   */
  async start(
    systemPrompt: string,
    taskPrompt: string,
    workingDirectory: string,
    model?: string,
    resumeSessionId?: string,
  ): Promise<void> {
    if (this.status === 'running') {
      throw new Error(`Agent ${this.id} is already running`);
    }

    this.status = 'running';
    this.maxTurnsReached = false;
    this.startedAt = Date.now();

    let args: string[];

    if (resumeSessionId) {
      // Resume an existing session — no need to re-supply prompts
      args = [
        '--resume', resumeSessionId,
        '--output-format', 'stream-json',
        '--max-turns', '200',
        '--verbose',
        '--dangerously-skip-permissions',
      ];
      console.log(`[AgentProcess] Resuming session ${resumeSessionId} for ${this.role}`);
    } else {
      args = [
        '-p', taskPrompt,
        '--system-prompt', systemPrompt,
        '--output-format', 'stream-json',
        '--max-turns', '200',
        '--verbose',
        '--dangerously-skip-permissions',
      ];
    }

    if (model) {
      args.push('--model', model);
    }

    this.process = spawn('claude', args, {
      cwd: workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    this.pid = this.process.pid || null;

    eventBus.emit('agent:spawned', {
      role: this.role,
      pid: this.pid!,
      taskId: this.taskId,
      agentId: this.id,
    });

    eventBus.emit('agent:status-changed', {
      role: this.role,
      status: 'running',
      taskId: this.taskId,
    });

    // Stream stdout line by line
    if (this.process.stdout) {
      const rl = createInterface({ input: this.process.stdout });
      rl.on('line', (line) => {
        this.handleOutput(line, 'stdout');
      });
    }

    // Stream stderr
    if (this.process.stderr) {
      const rl = createInterface({ input: this.process.stderr });
      rl.on('line', (line) => {
        this.handleOutput(line, 'stderr');
      });
    }

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      const exitCode = code ?? (signal ? 1 : 0);
      this.exitedAt = Date.now();
      this.status = exitCode === 0 ? 'completed' : 'failed';
      this.process = null;

      eventBus.emit('agent:exited', {
        role: this.role,
        exitCode,
        taskId: this.taskId,
        agentId: this.id,
      });

      eventBus.emit('agent:status-changed', {
        role: this.role,
        status: this.status,
        taskId: this.taskId,
      });
    });

    this.process.on('error', (err) => {
      this.status = 'failed';
      this.handleOutput(`Process error: ${err.message}`, 'stderr');

      eventBus.emit('agent:exited', {
        role: this.role,
        exitCode: 1,
        taskId: this.taskId,
        agentId: this.id,
      });

      eventBus.emit('agent:status-changed', {
        role: this.role,
        status: 'failed',
        taskId: this.taskId,
      });
    });
  }

  /**
   * Kill the agent process.
   */
  kill(): void {
    if (this.process && this.status === 'running') {
      this.status = 'killed';
      this.process.kill('SIGTERM');

      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      eventBus.emit('agent:status-changed', {
        role: this.role,
        status: 'killed',
        taskId: this.taskId,
      });
    }
  }

  /**
   * Get all captured output.
   */
  getOutput(): string[] {
    return [...this.outputBuffer];
  }

  /**
   * True if the agent exited with code != 0 within FAST_CRASH_MS of starting,
   * produced zero tokens, and no session ID was captured. This indicates the
   * CLI itself failed (usage limit, auth error, network) rather than the agent
   * doing work and failing.
   */
  get crashedFast(): boolean {
    if (this.exitedAt === 0 || this.startedAt === 0) return false;
    const runMs = this.exitedAt - this.startedAt;
    return (
      runMs < AgentProcess.FAST_CRASH_MS &&
      this.status === 'failed' &&
      this.tokensUsed.input === 0 &&
      this.tokensUsed.output === 0
    );
  }

  private handleOutput(line: string, type: 'stdout' | 'stderr'): void {
    this.outputBuffer.push(line);

    if (type === 'stderr') {
      this.lastStderrLines.push(line);
      if (this.lastStderrLines.length > AgentProcess.MAX_STDERR_LINES) {
        this.lastStderrLines.shift();
      }
    }

    // Try to parse streaming JSON for token usage
    this.tryParseTokenUsage(line);

    const message: AgentMessage = {
      id: uuid(),
      role: this.role,
      type,
      content: line,
      timestamp: new Date().toISOString(),
      taskId: this.taskId,
    };

    eventBus.emit('agent:output', message);
  }

  private static readonly RATE_LIMIT_PATTERN =
    /you've hit your limit|usage limit|rate.?limit|resets \d+[ap]m|exceeded.*(?:limit|quota)|limit.*exceeded|quota.*exceeded|too many requests|account.*limit/i;

  private tryParseTokenUsage(line: string): void {
    try {
      const data = JSON.parse(line);

      // Capture session ID and detect max-turns from the final result line
      if (data.type === 'result') {
        if (data.session_id) this.lastSessionId = data.session_id as string;
        if (data.subtype === 'error_max_turns') {
          this.maxTurnsReached = true;
          console.log(`[AgentProcess] ${this.role} hit max-turns (session: ${this.lastSessionId})`);
        }
      }

      // Detect rate-limit via API error type (e.g. {"error":{"type":"rate_limit_error"}})
      if (data.error?.type === 'rate_limit_error' || data.error?.type === 'overloaded_error') {
        this.markRateLimited(data.error?.message ?? `API error: ${data.error.type}`);
      }

      // Accumulate token usage
      if (data.usage) {
        const usage = data.usage;
        if (usage.input_tokens) this.tokensUsed.input += usage.input_tokens;
        if (usage.output_tokens) this.tokensUsed.output += usage.output_tokens;
      }
    } catch {
      // Not JSON — check as plain text (stderr often emits plain-text errors)
      if (AgentProcess.RATE_LIMIT_PATTERN.test(line)) {
        this.markRateLimited(line);
      }
    }
  }

  private markRateLimited(message: string): void {
    if (this.rateLimited) return; // already flagged
    this.rateLimited = true;
    this.rateLimitMessage = message;

    // Try to parse reset time from "resets 8pm (Europe/Stockholm)" pattern
    const resetMatch = message.match(/resets\s+(\d{1,2})(am|pm)\s*\(([^)]+)\)/i);
    if (resetMatch) {
      const hour = parseInt(resetMatch[1], 10);
      const isPm = resetMatch[2].toLowerCase() === 'pm';
      const tz = resetMatch[3];
      const resetHour24 = isPm && hour !== 12 ? hour + 12 : (!isPm && hour === 12 ? 0 : hour);
      const now = new Date();
      const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
      const resetDate = new Date(`${todayStr}T${String(resetHour24).padStart(2, '0')}:00:00`);
      const resetMs = resetDate.getTime() - now.getTime();
      this.rateLimitRetryMs = resetMs > 0 ? resetMs : 60_000;
    } else {
      this.rateLimitRetryMs = 5 * 60_000;
    }
    console.log(`[AgentProcess] ${this.role} hit rate/usage limit — retry in ${Math.round((this.rateLimitRetryMs ?? 0) / 1000)}s (session: ${this.lastSessionId})`);
  }
}
