/**
 * Tests for SessionManager — branch sync before PO stage.
 *
 * Acceptance criteria covered:
 *   AC1: Branch check occurs when pr.baseBranch is configured
 *   AC2: No switch when current branch already matches baseBranch
 *   AC3: switchBranch() called when current branch doesn't match
 *   AC4: pullBranch() called after switching to target branch
 *   AC5: Sync skipped when pr is undefined / no baseBranch
 *   AC6: Task fails (PO not spawned) when switch/pull throws
 *   AC7: EventBus events emitted: git:sync-started, git:sync-completed
 *   AC8: session.gitBranch reflects the target branch after sync
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// ---------------------------------------------------------------------------
// Shared state that the GitManager mock captures via reference
// ---------------------------------------------------------------------------

const gitState = {
  currentBranch: 'main',
  switchError: null as Error | null,
  pullError: null as Error | null,
  instance: null as any,
};

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    readFileSync: vi.fn().mockReturnValue('[]'),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('../GitManager', () => {
  return {
    GitManager: function GitManagerMock() {
      const inst = {
        getCurrentBranch: vi.fn(() => Promise.resolve(gitState.currentBranch)),
        switchBranch: vi.fn(() =>
          gitState.switchError ? Promise.reject(gitState.switchError) : Promise.resolve(undefined)
        ),
        pullBranch: vi.fn(() =>
          gitState.pullError ? Promise.reject(gitState.pullError) : Promise.resolve(undefined)
        ),
      };
      gitState.instance = inst;
      return inst;
    },
  };
});

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { SessionManager } from '../SessionManager';
import { eventBus } from '../EventBus';

// ---------------------------------------------------------------------------
// Minimal stub types
// ---------------------------------------------------------------------------

type MockProject = {
  id: string;
  name: string;
  path: string;
  labels: string[];
  pr?: { enabled?: boolean; baseBranch?: string };
};

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeProject(overrides: Partial<MockProject> = {}): MockProject {
  return {
    id: 'proj-1',
    name: 'Test Project',
    path: '/fake/project',
    labels: [],
    ...overrides,
  };
}

function makeProjectStore(project: MockProject) {
  return {
    findById: vi.fn().mockReturnValue(project),
  };
}

function makeArtifactManager() {
  return {
    getTaskDir: vi.fn().mockReturnValue('/fake/.orchestra/tasks/TASK-TEST'),
    buildContextForRole: vi.fn().mockReturnValue(''),
    writeArtifact: vi.fn(),
    readArtifact: vi.fn().mockReturnValue(null),
    listArtifacts: vi.fn().mockReturnValue([]),
  };
}

function makeAgentPool() {
  const agent = {
    id: 'agent-1',
    start: vi.fn().mockResolvedValue(undefined),
    rateLimited: false,
    maxTurnsReached: false,
    lastSessionId: null,
  };
  return {
    createAgent: vi.fn().mockReturnValue(agent),
    killAll: vi.fn(),
    getAgentById: vi.fn().mockReturnValue(agent),
    _agent: agent,
  };
}

// ---------------------------------------------------------------------------
// EventBus capture helper
// ---------------------------------------------------------------------------

function captureEvents() {
  const events: Array<{ name: string; payload: unknown }> = [];
  const spy = vi.spyOn(eventBus, 'emit');
  spy.mockImplementation((name: string, payload?: unknown) => {
    events.push({ name, payload });
    // Also call through so listeners work
    return EventEmitter.prototype.emit.call(eventBus, name, payload);
  });
  return events;
}

// ---------------------------------------------------------------------------
// Helper: build a SessionManager and call createTask
// ---------------------------------------------------------------------------

async function runCreateTask({
  project,
  gitCurrentBranch = 'main',
  gitSwitchError,
  gitPullError,
}: {
  project: MockProject;
  gitCurrentBranch?: string;
  gitSwitchError?: Error;
  gitPullError?: Error;
}) {
  // Set up per-test git state
  gitState.currentBranch = gitCurrentBranch;
  gitState.switchError = gitSwitchError ?? null;
  gitState.pullError = gitPullError ?? null;
  gitState.instance = null;

  const agentPool = makeAgentPool();
  const artifactManager = makeArtifactManager();
  const projectStore = makeProjectStore(project);

  const sm = new SessionManager(
    agentPool as any,
    artifactManager as any,
    {} as any, // placeholder — createTask overwrites with new GitManager(path)
    '/fake/project',
    projectStore as any,
    '/fake/.orchestra',
  );

  const events = captureEvents();

  let thrownError: Error | null = null;
  try {
    await sm.createTask(
      'Test task',
      'Test description',
      ['proj-1'],
      undefined, // scheduledAt
      undefined, // models
      undefined, // jiraIssueKey
      'development',
    );
  } catch (err: any) {
    thrownError = err;
  }

  return {
    sm,
    git: gitState.instance as {
      getCurrentBranch: ReturnType<typeof vi.fn>;
      switchBranch: ReturnType<typeof vi.fn>;
      pullBranch: ReturnType<typeof vi.fn>;
    },
    agentPool,
    events,
    thrownError,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionManager — syncToBaseBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gitState.currentBranch = 'main';
    gitState.switchError = null;
    gitState.pullError = null;
    gitState.instance = null;
  });

  // -------------------------------------------------------------------------
  // AC5 — no pr config → skip sync entirely
  // -------------------------------------------------------------------------
  it('AC5: does not call getCurrentBranch when no pr config', async () => {
    const project = makeProject(); // no pr field
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'old-feature' });
    expect(git.getCurrentBranch).not.toHaveBeenCalled();
  });

  it('AC5: does not call switchBranch when no pr config', async () => {
    const project = makeProject();
    const { git } = await runCreateTask({ project });
    expect(git.switchBranch).not.toHaveBeenCalled();
  });

  it('AC5: does not call pullBranch when no pr config', async () => {
    const project = makeProject();
    const { git } = await runCreateTask({ project });
    expect(git.pullBranch).not.toHaveBeenCalled();
  });

  it('AC5: spawns PO agent even when no pr config', async () => {
    const project = makeProject();
    const { agentPool } = await runCreateTask({ project });
    expect(agentPool.createAgent).toHaveBeenCalledWith('po', expect.any(String));
  });

  it('AC5: skips sync when pr exists but baseBranch is absent', async () => {
    const project = makeProject({ pr: { enabled: true } }); // no baseBranch
    const { git, agentPool } = await runCreateTask({ project, gitCurrentBranch: 'stale-branch' });
    expect(git.getCurrentBranch).not.toHaveBeenCalled();
    expect(git.switchBranch).not.toHaveBeenCalled();
    expect(git.pullBranch).not.toHaveBeenCalled();
    expect(agentPool.createAgent).toHaveBeenCalledWith('po', expect.any(String));
  });

  // -------------------------------------------------------------------------
  // AC1 — branch check occurs
  // -------------------------------------------------------------------------
  it('AC1: calls getCurrentBranch when baseBranch is configured', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'qa' });
    expect(git.getCurrentBranch).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // AC2 — already on target branch → no switch, but pull IS called
  // -------------------------------------------------------------------------
  it('AC2: does not call switchBranch when already on baseBranch', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'qa' });
    expect(git.switchBranch).not.toHaveBeenCalled();
  });

  it('AC2: still calls pullBranch when already on baseBranch', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'qa' });
    expect(git.pullBranch).toHaveBeenCalledWith('qa');
  });

  // -------------------------------------------------------------------------
  // AC3 — different branch → switchBranch called
  // -------------------------------------------------------------------------
  it('AC3: calls switchBranch with baseBranch when on different branch', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'feature/old-work' });
    expect(git.switchBranch).toHaveBeenCalledWith('qa');
  });

  // -------------------------------------------------------------------------
  // AC4 — pull after switch
  // -------------------------------------------------------------------------
  it('AC4: calls pullBranch with baseBranch after switching', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'feature/old-work' });
    expect(git.pullBranch).toHaveBeenCalledWith('qa');
  });

  it('AC4: pullBranch is called after switchBranch', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { git } = await runCreateTask({ project, gitCurrentBranch: 'feature/old-work' });

    const switchOrder = git.switchBranch.mock.invocationCallOrder[0];
    const pullOrder = git.pullBranch.mock.invocationCallOrder[0];
    expect(pullOrder).toBeGreaterThan(switchOrder);
  });

  // -------------------------------------------------------------------------
  // AC7 — events emitted
  // -------------------------------------------------------------------------
  it('AC7: emits git:sync-started when baseBranch is configured', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { events } = await runCreateTask({ project, gitCurrentBranch: 'main' });

    const names = events.map((e) => e.name);
    expect(names).toContain('git:sync-started');
  });

  it('AC7: emits git:sync-completed on success', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { events } = await runCreateTask({ project, gitCurrentBranch: 'main' });

    const names = events.map((e) => e.name);
    expect(names).toContain('git:sync-completed');
  });

  it('AC7: git:sync-started emitted before git:sync-completed', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { events } = await runCreateTask({ project, gitCurrentBranch: 'feature/old-work' });

    const startIdx = events.findIndex((e) => e.name === 'git:sync-started');
    const doneIdx = events.findIndex((e) => e.name === 'git:sync-completed');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    expect(doneIdx).toBeGreaterThan(startIdx);
  });

  // -------------------------------------------------------------------------
  // AC8 — session.gitBranch updated
  // -------------------------------------------------------------------------
  it('AC8: session.gitBranch is set to baseBranch after sync', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { sm } = await runCreateTask({ project, gitCurrentBranch: 'feature/old-work' });

    const session = sm.getSession();
    expect(session?.gitBranch).toBe('qa');
  });

  it('AC8: session.gitBranch is set even when already on target branch', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { sm } = await runCreateTask({ project, gitCurrentBranch: 'qa' });

    const session = sm.getSession();
    expect(session?.gitBranch).toBe('qa');
  });

  // -------------------------------------------------------------------------
  // AC6 — errors surface as task failure, PO not spawned
  // -------------------------------------------------------------------------
  it('AC6: marks session failed when switchBranch throws', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const error = new Error('Cannot checkout: you have uncommitted changes');

    const { sm } = await runCreateTask({
      project,
      gitCurrentBranch: 'feature/old-work',
      gitSwitchError: error,
    });

    const session = sm.getSession();
    expect(session?.currentStage).toBe('failed');
  });

  it('AC6: session.error contains useful message when switchBranch throws', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const error = new Error('uncommitted changes block checkout');

    const { sm } = await runCreateTask({
      project,
      gitCurrentBranch: 'feature/old-work',
      gitSwitchError: error,
    });

    expect(sm.getSession()?.error).toMatch(/uncommitted changes|sync|Branch sync/i);
  });

  it('AC6: does NOT spawn PO when switchBranch throws', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { agentPool } = await runCreateTask({
      project,
      gitCurrentBranch: 'feature/old-work',
      gitSwitchError: new Error('checkout failed'),
    });

    expect(agentPool.createAgent).not.toHaveBeenCalledWith('po', expect.any(String));
  });

  it('AC6: marks session failed when pullBranch throws', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { sm } = await runCreateTask({
      project,
      gitCurrentBranch: 'qa',
      gitPullError: new Error('remote unavailable'),
    });

    expect(sm.getSession()?.currentStage).toBe('failed');
  });

  it('AC6: does NOT spawn PO when pullBranch throws', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { agentPool } = await runCreateTask({
      project,
      gitCurrentBranch: 'qa',
      gitPullError: new Error('remote unavailable'),
    });

    expect(agentPool.createAgent).not.toHaveBeenCalledWith('po', expect.any(String));
  });

  it('AC6: emits session:failed event when sync fails', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { events } = await runCreateTask({
      project,
      gitCurrentBranch: 'main',
      gitSwitchError: new Error('checkout failed'),
    });

    expect(events.find((e) => e.name === 'session:failed')).toBeDefined();
  });

  it('AC6: does NOT emit git:sync-completed when sync fails', async () => {
    const project = makeProject({ pr: { baseBranch: 'qa' } });
    const { events } = await runCreateTask({
      project,
      gitCurrentBranch: 'main',
      gitSwitchError: new Error('checkout failed'),
    });

    expect(events.find((e) => e.name === 'git:sync-completed')).toBeUndefined();
  });
});
