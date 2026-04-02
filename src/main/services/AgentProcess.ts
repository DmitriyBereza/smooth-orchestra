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

  private process: ChildProcess | null = null;
  private outputBuffer: string[] = [];

  constructor(
    public readonly role: AgentRole,
    public readonly taskId: string,
  ) {
    this.id = `${role}-${uuid().slice(0, 8)}`;
  }

  /**
   * Spawn the claude CLI process with the given system prompt and task prompt.
   */
  async start(
    systemPrompt: string,
    taskPrompt: string,
    workingDirectory: string,
  ): Promise<void> {
    if (this.status === 'running') {
      throw new Error(`Agent ${this.id} is already running`);
    }

    this.status = 'running';

    // Spawn claude CLI in print mode with streaming JSON output
    const args = [
      '-p', taskPrompt,
      '--system-prompt', systemPrompt,
      '--output-format', 'stream-json',
      '--max-turns', '50',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

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
      if (data.type === 'usage' || data.usage) {
        const usage = data.usage || data;
        if (usage.input_tokens) this.tokensUsed.input += usage.input_tokens;
        if (usage.output_tokens) this.tokensUsed.output += usage.output_tokens;
      }
    } catch {
      // Not JSON or not a usage line — ignore
    }
  }
}
