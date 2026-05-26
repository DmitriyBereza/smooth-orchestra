import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChildProcess } from 'child_process';

// We'll mock child_process to avoid actually spawning cursor
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'child_process';
import { CursorAgentProcess } from '../backends/CursorAgentProcess';
import type { AgentBackendEvents } from '../backends/AgentBackend';
import { EventEmitter, Readable } from 'stream';

function createMockProcess(): ChildProcess {
  const proc = new EventEmitter() as any;
  proc.stdout = new Readable({ read() {} });
  proc.stderr = new Readable({ read() {} });
  proc.stdin = new Readable({ read() {} });
  proc.pid = 12345;
  proc.kill = vi.fn();
  return proc as ChildProcess;
}

describe('CursorAgentProcess', () => {
  let agent: CursorAgentProcess;
  let mockProc: ChildProcess;

  beforeEach(() => {
    mockProc = createMockProcess();
    (spawn as any).mockReturnValue(mockProc);
    agent = new CursorAgentProcess();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('metadata', () => {
    it('should have name "cursor-cli"', () => {
      expect(agent.name).toBe('cursor-cli');
    });

    it('should start with idle status', () => {
      expect(agent.status).toBe('idle');
    });

    it('should start with null sessionId', () => {
      expect(agent.sessionId).toBeNull();
    });

    it('should start with zero token usage', () => {
      expect(agent.tokensUsed).toEqual({ input: 0, output: 0 });
    });
  });

  describe('capabilities', () => {
    it('should report cursor-specific capabilities', () => {
      const caps = agent.capabilities();
      expect(caps.supportsSessionResume).toBe(true);
      expect(caps.supportsStreamingJson).toBe(true);
      // Cursor uses .cursor/rules/ files, not --system-prompt flag
      expect(caps.supportsSystemPrompt).toBe(false);
      expect(caps.supportsMaxTurns).toBe(false);
      expect(caps.supportsDangerousPermissions).toBe(false);
      expect(caps.supportsMcp).toBe(true);
    });
  });

  describe('spawn', () => {
    it('should spawn cursor process with correct args', async () => {
      await agent.spawn({
        taskPrompt: 'Fix the bug in auth.ts',
        systemPrompt: 'You are a developer',
        workingDirectory: '/projects/myapp',
      });

      expect(spawn).toHaveBeenCalledWith(
        'cursor',
        expect.arrayContaining([
          'agent',
          '-p', 'Fix the bug in auth.ts',
          '--output-format', 'stream-json',
          '--force',
        ]),
        expect.objectContaining({
          cwd: '/projects/myapp',
          stdio: ['pipe', 'pipe', 'pipe'],
        }),
      );
    });

    it('should set status to running after spawn', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });
      expect(agent.status).toBe('running');
    });

    it('should pass model flag when specified', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
        model: 'composer-2.5',
      });

      expect(spawn).toHaveBeenCalledWith(
        'cursor',
        expect.arrayContaining(['--model', 'composer-2.5']),
        expect.any(Object),
      );
    });

    it('should pass CURSOR_API_KEY env when apiKey is provided', async () => {
      agent = new CursorAgentProcess({ apiKey: 'sk-test-key' });
      (spawn as any).mockReturnValue(mockProc);

      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      expect(spawn).toHaveBeenCalledWith(
        'cursor',
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            CURSOR_API_KEY: 'sk-test-key',
          }),
        }),
      );
    });

    it('should throw if already running', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      await expect(
        agent.spawn({
          taskPrompt: 'task2',
          systemPrompt: 'sys2',
          workingDirectory: '/tmp',
        }),
      ).rejects.toThrow('already running');
    });
  });

  describe('resume', () => {
    it('should spawn cursor with --resume flag', async () => {
      await agent.resume('chat-abc-123');

      expect(spawn).toHaveBeenCalledWith(
        'cursor',
        expect.arrayContaining(['agent', '--resume', 'chat-abc-123']),
        expect.any(Object),
      );
    });

    it('should set sessionId to the resumed session', async () => {
      await agent.resume('chat-abc-123');
      expect(agent.sessionId).toBe('chat-abc-123');
    });
  });

  describe('kill', () => {
    it('should send SIGTERM to process', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });
      agent.kill();
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should set status to killed', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });
      agent.kill();
      expect(agent.status).toBe('killed');
    });

    it('should be safe to call when not running', () => {
      expect(() => agent.kill()).not.toThrow();
    });
  });

  describe('output parsing', () => {
    it('should emit output events for stdout lines', async () => {
      const handler = vi.fn();
      agent.on('output', handler);

      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      // Simulate stdout data
      mockProc.stdout!.push('some output line\n');

      // readline is async, give it a tick
      await new Promise((r) => setTimeout(r, 10));

      expect(handler).toHaveBeenCalledWith('some output line', 'stdout');
    });

    it('should parse JSON streaming events for token usage', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      const jsonLine = JSON.stringify({
        usage: { input_tokens: 100, output_tokens: 50 },
      });
      mockProc.stdout!.push(jsonLine + '\n');

      await new Promise((r) => setTimeout(r, 10));

      expect(agent.tokensUsed).toEqual({ input: 100, output: 50 });
    });

    it('should capture session ID from result events', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      const jsonLine = JSON.stringify({
        type: 'result',
        session_id: 'cursor-session-xyz',
      });
      mockProc.stdout!.push(jsonLine + '\n');

      await new Promise((r) => setTimeout(r, 10));

      expect(agent.sessionId).toBe('cursor-session-xyz');
    });
  });

  describe('event handling', () => {
    it('should emit exited on process exit', async () => {
      const exitHandler = vi.fn();
      agent.on('exited', exitHandler);

      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      mockProc.emit('exit', 0, null);

      expect(exitHandler).toHaveBeenCalledWith(0, null);
      expect(agent.status).toBe('completed');
    });

    it('should set status to failed on non-zero exit', async () => {
      await agent.spawn({
        taskPrompt: 'task',
        systemPrompt: 'sys',
        workingDirectory: '/tmp',
      });

      mockProc.emit('exit', 1, null);
      expect(agent.status).toBe('failed');
    });

    it('should support off() to remove listeners', () => {
      const handler = vi.fn();
      agent.on('output', handler);
      agent.off('output', handler);
      // No way to trigger without spawning, but at least it doesn't throw
    });
  });
});
