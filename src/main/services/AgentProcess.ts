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

  private process: ChildProcess | null = null;
  private outputBuffer: string[] = [];

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

  private handleOutput(line: string, type: 'stdout' | 'stderr'): void {
    this.outputBuffer.push(line);

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

      // Detect rate-limit messages in any text content
      const textContent = typeof data.content === 'string'
        ? data.content
        : Array.isArray(data.content)
          ? data.content.map((b: any) => b.text ?? '').join(' ')
          : '';
      if (textContent && /you've hit your limit|rate limit|resets \d+[ap]m/i.test(textContent)) {
        this.rateLimited = true;
        this.rateLimitMessage = textContent;
        // Try to parse reset time from "resets 8pm (Europe/Stockholm)" pattern
        const resetMatch = textContent.match(/resets\s+(\d{1,2})(am|pm)\s*\(([^)]+)\)/i);
        if (resetMatch) {
          const hour = parseInt(resetMatch[1], 10);
          const isPm = resetMatch[2].toLowerCase() === 'pm';
          const tz = resetMatch[3];
          const resetHour24 = isPm && hour !== 12 ? hour + 12 : (!isPm && hour === 12 ? 0 : hour);
          // Build a Date for today at reset time, using the timezone
          const now = new Date();
          const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
          const resetDate = new Date(`${todayStr}T${String(resetHour24).padStart(2, '0')}:00:00`);
          // Adjust for timezone offset by formatting back
          const resetMs = resetDate.getTime() - now.getTime();
          this.rateLimitRetryMs = resetMs > 0 ? resetMs : 60_000; // fallback 1 minute
        } else {
          this.rateLimitRetryMs = 5 * 60_000; // fallback: 5 minutes
        }
        console.log(`[AgentProcess] ${this.role} hit rate limit — retry in ${Math.round((this.rateLimitRetryMs ?? 0) / 1000)}s (session: ${this.lastSessionId})`);
      }

      // Accumulate token usage
      if (data.usage) {
        const usage = data.usage;
        if (usage.input_tokens) this.tokensUsed.input += usage.input_tokens;
        if (usage.output_tokens) this.tokensUsed.output += usage.output_tokens;
      }
    } catch {
      // Not JSON or not a usage line — ignore
    }
  }
}
