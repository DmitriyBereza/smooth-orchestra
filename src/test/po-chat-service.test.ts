/**
 * Unit tests for PoChatService
 *
 * Tests cover:
 * - History persistence (read/write/prune)
 * - Busy state management
 * - clearChat behaviour
 * - Error handling for invalid / inaccessible projects
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { PoChatService } from '../main/services/PoChatService';
import type { ProjectStore } from '../main/services/ProjectStore';
import type { PoChatMessage } from '../main/types/po-chat';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'po-chat-test-'));
}

function makeProjectStore(projectPath: string | null): ProjectStore {
  return {
    findById: (id: string) => {
      if (id === 'valid-project' && projectPath !== null) {
        return { id: 'valid-project', name: 'Test', path: projectPath, labels: [], createdAt: '', updatedAt: '' };
      }
      return undefined;
    },
  } as unknown as ProjectStore;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PoChatService', () => {
  let tmpDir: string;
  let service: PoChatService;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    const projectStore = makeProjectStore(tmpDir);
    service = new PoChatService(projectStore, tmpDir);
  });

  afterEach(() => {
    service.dispose();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── getHistory ──────────────────────────────────────────────────────────────

  it('returns empty array when no history file exists', async () => {
    const messages = await service.getHistory('valid-project');
    expect(messages).toEqual([]);
  });

  it('reads and returns persisted messages', async () => {
    const historyDir = path.join(tmpDir, 'po-chat', 'valid-project');
    fs.mkdirSync(historyDir, { recursive: true });
    const msgs: PoChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'Hi there!', timestamp: new Date().toISOString() },
    ];
    fs.writeFileSync(path.join(historyDir, 'history.json'), JSON.stringify(msgs), 'utf-8');

    const result = await service.getHistory('valid-project');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Hello');
    expect(result[1].content).toBe('Hi there!');
  });

  it('returns empty array if history file is corrupted', async () => {
    const historyDir = path.join(tmpDir, 'po-chat', 'valid-project');
    fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(path.join(historyDir, 'history.json'), 'not-valid-json', 'utf-8');

    const result = await service.getHistory('valid-project');
    expect(result).toEqual([]);
  });

  // ── clearChat ───────────────────────────────────────────────────────────────

  it('clearChat removes the history file', async () => {
    const historyDir = path.join(tmpDir, 'po-chat', 'valid-project');
    fs.mkdirSync(historyDir, { recursive: true });
    const historyPath = path.join(historyDir, 'history.json');
    fs.writeFileSync(historyPath, JSON.stringify([{ id: '1', role: 'user', content: 'Hi', timestamp: '' }]), 'utf-8');

    await service.clearChat('valid-project');
    expect(fs.existsSync(historyPath)).toBe(false);
  });

  it('clearChat resets busy and sessionId state', async () => {
    // Force busy state by directly accessing private maps via cast
    const s = service as any;
    s.busy.set('valid-project', true);
    s.sessionIds.set('valid-project', 'some-session-id');

    await service.clearChat('valid-project');

    expect(s.busy.get('valid-project')).toBe(false);
    expect(s.sessionIds.has('valid-project')).toBe(false);
  });

  it('clearChat on non-existent project does not throw', async () => {
    await expect(service.clearChat('unknown-project')).resolves.toBeUndefined();
  });

  // ── pruneHistory ────────────────────────────────────────────────────────────

  it('pruneHistory removes messages older than 3 days', async () => {
    const historyDir = path.join(tmpDir, 'po-chat', 'valid-project');
    fs.mkdirSync(historyDir, { recursive: true });

    const now = Date.now();
    const old = new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(); // 4 days ago
    const fresh = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago

    const msgs: PoChatMessage[] = [
      { id: '1', role: 'user', content: 'Old message', timestamp: old },
      { id: '2', role: 'assistant', content: 'Fresh message', timestamp: fresh },
    ];
    fs.writeFileSync(path.join(historyDir, 'history.json'), JSON.stringify(msgs), 'utf-8');

    await (service as any).pruneHistory();

    const result = await service.getHistory('valid-project');
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Fresh message');
  });

  it('pruneHistory deletes history file if all messages are old', async () => {
    const historyDir = path.join(tmpDir, 'po-chat', 'valid-project');
    fs.mkdirSync(historyDir, { recursive: true });
    const historyPath = path.join(historyDir, 'history.json');

    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const msgs: PoChatMessage[] = [
      { id: '1', role: 'user', content: 'Very old', timestamp: old },
    ];
    fs.writeFileSync(historyPath, JSON.stringify(msgs), 'utf-8');

    await (service as any).pruneHistory();

    expect(fs.existsSync(historyPath)).toBe(false);
  });

  // ── handleMessage error cases ───────────────────────────────────────────────

  it('handleMessage emits po-chat:error when project not found', async () => {
    const emittedEvents: any[] = [];
    const { eventBus } = await import('../main/services/EventBus');
    eventBus.on('po-chat:error', (data) => emittedEvents.push(data));

    await service.handleMessage('nonexistent-project', 'hello');

    eventBus.removeAllListeners('po-chat:error');
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].projectId).toBe('nonexistent-project');
    expect(emittedEvents[0].error).toMatch(/not found/i);
  });

  it('handleMessage emits po-chat:error when project path is inaccessible', async () => {
    const projectStore = makeProjectStore('/nonexistent/path/xyz');
    const svc = new PoChatService(projectStore, tmpDir);

    const emittedEvents: any[] = [];
    const { eventBus } = await import('../main/services/EventBus');
    eventBus.on('po-chat:error', (data) => emittedEvents.push(data));

    await svc.handleMessage('valid-project', 'hello');

    eventBus.removeAllListeners('po-chat:error');
    svc.dispose();
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].error).toMatch(/inaccessible|not found|path/i);
  });

  it('handleMessage emits po-chat:busy when already processing', async () => {
    const s = service as any;
    s.busy.set('valid-project', true);

    const emittedEvents: any[] = [];
    const { eventBus } = await import('../main/services/EventBus');
    eventBus.on('po-chat:busy', (data) => emittedEvents.push(data));

    await service.handleMessage('valid-project', 'hello');

    eventBus.removeAllListeners('po-chat:busy');
    expect(emittedEvents).toHaveLength(1);
    expect(emittedEvents[0].projectId).toBe('valid-project');
  });
});
