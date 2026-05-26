import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AgentBackend,
  AgentBackendConfig,
  AgentBackendEvents,
  AgentSpawnOptions,
  AgentTokenUsage,
  BackendCapabilities,
} from '../backends/AgentBackend';

describe('AgentBackend interface contract', () => {
  /**
   * A mock implementation that satisfies the AgentBackend interface,
   * proving the interface is correctly defined and implementable.
   */
  class MockBackend implements AgentBackend {
    readonly name = 'mock';
    private _status: 'idle' | 'running' | 'completed' | 'failed' | 'killed' = 'idle';
    private _sessionId: string | null = null;
    private _tokens: AgentTokenUsage = { input: 0, output: 0 };
    private listeners = new Map<string, Set<(...args: any[]) => void>>();

    get status() { return this._status; }
    get sessionId() { return this._sessionId; }
    get tokensUsed() { return { ...this._tokens }; }

    capabilities(): BackendCapabilities {
      return {
        supportsSessionResume: true,
        supportsStreamingJson: true,
        supportsSystemPrompt: true,
        supportsMaxTurns: true,
        supportsDangerousPermissions: false,
        supportsMcp: false,
      };
    }

    async spawn(options: AgentSpawnOptions): Promise<void> {
      this._status = 'running';
      this._sessionId = 'mock-session-123';
    }

    async resume(sessionId: string): Promise<void> {
      this._status = 'running';
      this._sessionId = sessionId;
    }

    kill(): void {
      this._status = 'killed';
    }

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

    // Helper to simulate events in tests
    emit<E extends keyof AgentBackendEvents>(
      event: E,
      ...args: Parameters<AgentBackendEvents[E]>
    ): void {
      this.listeners.get(event)?.forEach((fn) => (fn as any)(...args));
    }
  }

  let backend: MockBackend;

  beforeEach(() => {
    backend = new MockBackend();
  });

  it('should expose backend name', () => {
    expect(backend.name).toBe('mock');
  });

  it('should start in idle status', () => {
    expect(backend.status).toBe('idle');
  });

  it('should transition to running on spawn', async () => {
    await backend.spawn({
      systemPrompt: 'You are a helpful assistant',
      taskPrompt: 'Fix the bug',
      workingDirectory: '/tmp',
    });
    expect(backend.status).toBe('running');
  });

  it('should capture session ID after spawn', async () => {
    await backend.spawn({
      systemPrompt: 'sys',
      taskPrompt: 'task',
      workingDirectory: '/tmp',
    });
    expect(backend.sessionId).toBe('mock-session-123');
  });

  it('should resume with a given session ID', async () => {
    await backend.resume('existing-session-456');
    expect(backend.status).toBe('running');
    expect(backend.sessionId).toBe('existing-session-456');
  });

  it('should transition to killed on kill()', async () => {
    await backend.spawn({
      systemPrompt: 'sys',
      taskPrompt: 'task',
      workingDirectory: '/tmp',
    });
    backend.kill();
    expect(backend.status).toBe('killed');
  });

  it('should report token usage', () => {
    expect(backend.tokensUsed).toEqual({ input: 0, output: 0 });
  });

  it('should report capabilities', () => {
    const caps = backend.capabilities();
    expect(caps).toHaveProperty('supportsSessionResume');
    expect(caps).toHaveProperty('supportsStreamingJson');
    expect(caps).toHaveProperty('supportsSystemPrompt');
    expect(caps).toHaveProperty('supportsMaxTurns');
    expect(caps).toHaveProperty('supportsDangerousPermissions');
    expect(caps).toHaveProperty('supportsMcp');
  });

  it('should support event subscription and emission', async () => {
    const outputHandler = vi.fn();
    backend.on('output', outputHandler);

    backend.emit('output', 'hello world', 'stdout');
    expect(outputHandler).toHaveBeenCalledWith('hello world', 'stdout');
  });

  it('should support unsubscribing from events', () => {
    const handler = vi.fn();
    backend.on('output', handler);
    backend.off('output', handler);
    backend.emit('output', 'ignored', 'stdout');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit exited events with code and signals', () => {
    const exitHandler = vi.fn();
    backend.on('exited', exitHandler);
    backend.emit('exited', 0, null);
    expect(exitHandler).toHaveBeenCalledWith(0, null);
  });

  it('should emit rateLimited events', () => {
    const handler = vi.fn();
    backend.on('rateLimited', handler);
    backend.emit('rateLimited', 'Rate limit hit', 300000);
    expect(handler).toHaveBeenCalledWith('Rate limit hit', 300000);
  });

  it('should emit maxTurnsReached events', () => {
    const handler = vi.fn();
    backend.on('maxTurnsReached', handler);
    backend.emit('maxTurnsReached', 'session-abc');
    expect(handler).toHaveBeenCalledWith('session-abc');
  });
});

describe('AgentBackendConfig', () => {
  it('should define valid backend types', () => {
    const config: AgentBackendConfig = {
      type: 'claude-cli',
    };
    expect(config.type).toBe('claude-cli');

    const cursorConfig: AgentBackendConfig = {
      type: 'cursor-cli',
      apiKey: 'test-key',
    };
    expect(cursorConfig.type).toBe('cursor-cli');

    const sdkConfig: AgentBackendConfig = {
      type: 'cursor-sdk',
      apiKey: 'test-key',
    };
    expect(sdkConfig.type).toBe('cursor-sdk');
  });
});
