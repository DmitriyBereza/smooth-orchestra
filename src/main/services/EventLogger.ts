import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from './EventBus';

export interface LogEntry {
  id: string;
  timestamp: string;
  eventType: string;
  category: 'session' | 'agent' | 'artifact' | 'git' | 'lock' | 'command' | 'system';
  role?: string;
  taskId?: string;
  message: string;
  data?: Record<string, any>;
}

export class EventLogger {
  private logPath: string;
  private writeStream: fs.WriteStream;

  constructor(orchestraDir: string) {
    this.logPath = path.join(orchestraDir, 'events.log');
    this.writeStream = fs.createWriteStream(this.logPath, { flags: 'a' });
    this.subscribeToEvents();
  }

  private subscribeToEvents(): void {
    // Skip agent:output — too high-volume for persistent logging.
    // Agent output is already streamed to the frontend via SocketServer.

    eventBus.on('agent:spawned', (data) => {
      this.appendEntry(this.createEntry(
        'agent:spawned',
        'agent',
        `Agent "${data.role}" spawned (PID ${data.pid})`,
        { role: data.role, taskId: data.taskId },
      ));
    });

    eventBus.on('agent:exited', (data) => {
      this.appendEntry(this.createEntry(
        'agent:exited',
        'agent',
        `Agent "${data.role}" exited with code ${data.exitCode}`,
        { role: data.role, taskId: data.taskId },
      ));
    });

    eventBus.on('agent:status-changed', (data) => {
      this.appendEntry(this.createEntry(
        'agent:status-changed',
        'agent',
        `Agent "${data.role}" status changed to "${data.status}"`,
        { role: data.role, taskId: data.taskId },
      ));
    });

    // Session events
    eventBus.on('session:created', (session) => {
      this.appendEntry(this.createEntry(
        'session:created',
        'session',
        `Session "${session.id}" created for task "${session.task.title}"`,
        { taskId: session.task.id },
      ));
    });

    eventBus.on('session:stage-changed', (data) => {
      this.appendEntry(this.createEntry(
        'session:stage-changed',
        'session',
        `Session "${data.sessionId}" stage: ${data.from} → ${data.to}`,
        {},
      ));
    });

    eventBus.on('session:completed', (data) => {
      this.appendEntry(this.createEntry(
        'session:completed',
        'session',
        `Session "${data.sessionId}" completed`,
        { taskId: data.taskId },
      ));
    });

    eventBus.on('session:failed', (data) => {
      this.appendEntry(this.createEntry(
        'session:failed',
        'session',
        `Session "${data.sessionId}" failed: ${data.error}`,
        { taskId: data.taskId },
      ));
    });

    // Artifact events
    eventBus.on('artifact:written', (data) => {
      this.appendEntry(this.createEntry(
        'artifact:written',
        'artifact',
        `Artifact "${data.name}" written to ${data.path}`,
        { taskId: data.taskId },
      ));
    });

    // Git events
    eventBus.on('git:branch-created', (data) => {
      this.appendEntry(this.createEntry(
        'git:branch-created',
        'git',
        `Branch "${data.branch}" created`,
        { taskId: data.taskId },
      ));
    });

    // Lock events
    eventBus.on('lock:acquired', (data) => {
      this.appendEntry(this.createEntry(
        'lock:acquired',
        'lock',
        `Lock acquired on "${data.filepath}" by ${data.holder}`,
        { role: data.holder, taskId: data.taskId },
      ));
    });

    eventBus.on('lock:released', (data) => {
      this.appendEntry(this.createEntry(
        'lock:released',
        'lock',
        `Lock released on "${data.filepath}" by ${data.holder}`,
        { role: data.holder },
      ));
    });
  }

  private createEntry(
    eventType: string,
    category: LogEntry['category'],
    message: string,
    extra: { role?: string; taskId?: string; data?: Record<string, any> },
  ): LogEntry {
    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      eventType,
      category,
      role: extra.role,
      taskId: extra.taskId,
      message,
      data: extra.data,
    };
  }

  private appendEntry(entry: LogEntry): void {
    this.writeStream.write(JSON.stringify(entry) + '\n');
  }

  getEvents(filters?: {
    category?: string;
    role?: string;
    taskId?: string;
    limit?: number;
    after?: string;
  }): LogEntry[] {
    let entries: LogEntry[] = [];

    try {
      const content = fs.readFileSync(this.logPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim().length > 0);

      for (const line of lines) {
        try {
          entries.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      return [];
    }

    // Apply filters
    if (filters) {
      if (filters.category) {
        entries = entries.filter((e) => e.category === filters.category);
      }
      if (filters.role) {
        entries = entries.filter((e) => e.role === filters.role);
      }
      if (filters.taskId) {
        entries = entries.filter((e) => e.taskId === filters.taskId);
      }
      if (filters.after) {
        const afterDate = new Date(filters.after).getTime();
        entries = entries.filter((e) => new Date(e.timestamp).getTime() > afterDate);
      }
    }

    // Sort newest first
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    const limit = filters?.limit ?? 100;
    return entries.slice(0, limit);
  }
}
