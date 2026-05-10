import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { v4 as uuid } from 'uuid';
import {
  StandbyRole,
  StandbyState,
  BacklogItem,
  STANDBY_ROLES,
} from '../types/standby';
import { ProjectRecord } from '../types/project';
import { eventBus } from './EventBus';
import { SessionManager } from './SessionManager';
import { ProjectStore } from './ProjectStore';
import { GitManager } from './GitManager';
import { getStandbyPrompt } from '../prompts/standby';
import { buildManualQaContext } from './PromptContextBuilder';

/**
 * Owns the idle-time improvement loop.
 *
 * Responsibilities:
 *   - Persistent ON/OFF toggle (default OFF — never burns API limits without consent).
 *   - 1-minute idle timer; each tick spawns one standby agent with a (role, project) pair.
 *   - Round-robin across (1) the three standby roles AND (2) the registered projects whose
 *     `standby.enabled === true`. Both indexes advance every tick — over a few ticks every
 *     enabled project sees every role in turn.
 *   - Cross-rotation memory under .orchestra/standby/_memory/{role}__{projectId}.md so each
 *     (role, project) pair tracks its own history.
 *   - Backlog of proposals at .orchestra/standby/backlog.json (each item carries projectId
 *     so the UI can pre-select the source project on promote).
 *   - Auto-execute governor: small tech-debt items can be promoted to a real dev pipeline
 *     within a rate cap, scoped to the originating project.
 *
 * Standby agents are spawned as standalone `claude` CLI processes (not via AgentPool) — they
 * are orthogonal to the task pipeline.
 */
export class StandbyScheduler {
  private state: StandbyState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private currentProcess: ChildProcess | null = null;
  private currentRole: StandbyRole | null = null;
  private statePath: string;
  private backlogPath: string;
  private standbyDir: string;
  private memoryDir: string;

  private rateLimitedUntil: string | null = null;
  private rateLimitResumeTimer: ReturnType<typeof setTimeout> | null = null;

  private static readonly TICK_INTERVAL_MS = 60_000;
  private static readonly MAX_BACKLOG_ITEMS = 100;
  private static readonly SCANNER_MODEL = 'claude-opus-4-6';
  private static readonly AUTO_EXECUTE_MODEL = 'claude-sonnet-4-6';
  private static readonly RATE_LIMIT_PATTERN =
    /you've hit your limit|usage limit|rate.?limit|resets \d+[ap]m|exceeded.*(?:limit|quota)|limit.*exceeded|quota.*exceeded|too many requests|account.*limit/i;

  /**
   * Title patterns that indicate removal / sunsetting / dependency-removal tasks.
   * These are never auto-executed — they require human review.
   */
  private static readonly EXCLUDED_TITLE_PATTERNS = [
    /\bremov(e|al|ing)\b/i,
    /\bsunsett?(ing)?\b/i,
    /\bdeprecate\b/i,
    /\bdelete\b/i,
    /\bdrop\b/i,
    /\buninstall\b/i,
  ];

  constructor(
    private orchestraDir: string,
    private orchestraProjectPath: string,
    private sessionManager: SessionManager,
    private projectStore: ProjectStore | undefined,
  ) {
    this.standbyDir = path.join(orchestraDir, 'standby');
    this.memoryDir = path.join(this.standbyDir, '_memory');
    this.statePath = path.join(this.standbyDir, 'state.json');
    this.backlogPath = path.join(this.standbyDir, 'backlog.json');
    this.ensureDirs();
    this.state = this.loadState();
    this.ensureBacklogFile();
    this.attachLifecycleListeners();

    if (this.state.enabled) {
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  getState(): StandbyState {
    return { ...this.state, rateLimitedUntil: this.rateLimitedUntil };
  }

  setEnabled(enabled: boolean): StandbyState {
    if (this.state.enabled === enabled) return this.getState();
    this.state.enabled = enabled;
    this.persistState();

    if (enabled) {
      console.log('[StandbyScheduler] enabled — first tick in 60s');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
    } else {
      console.log('[StandbyScheduler] disabled — cancelling pending tick');
      this.cancelTick();
      this.killCurrentProcess();
    }

    eventBus.emit('standby:state-changed', { state: this.getState() });
    return this.getState();
  }

  getBacklog(): BacklogItem[] {
    return this.loadBacklog();
  }

  /**
   * Promote a backlog item to a real task using the chosen pipeline type.
   * Returns the new task ID (created via SessionManager.createTask).
   */
  async promoteItem(
    itemId: string,
    pipelineType: 'development' | 'marketing' | 'design',
    projectIds: string[],
  ): Promise<string> {
    const backlog = this.loadBacklog();
    const item = backlog.find((b) => b.id === itemId);
    if (!item) throw new Error(`Backlog item not found: ${itemId}`);
    if (item.status !== 'draft') {
      throw new Error(`Backlog item ${itemId} is not in draft state (current: ${item.status})`);
    }

    const session = await this.sessionManager.createTask(
      item.title,
      item.body,
      projectIds,
      undefined,
      undefined,
      undefined,
      pipelineType,
    );

    item.status = 'promoted';
    item.promotedTaskId = session.task.id;
    this.saveBacklog(backlog);
    this.appendToMemory(
      item.source,
      item.projectId ?? null,
      `promoted: ${item.id} ${item.title} → ${session.task.id}`,
    );

    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    return session.task.id;
  }

  /**
   * Mark an item promoted *without* creating a task. Used by the UI flow where
   * the user confirms models in the New Task form and submits through the
   * normal task-create path; this method just stamps the backlog status with
   * the resulting task ID after the task has been created.
   */
  markPromoted(itemId: string, taskId: string): BacklogItem[] {
    const backlog = this.loadBacklog();
    const item = backlog.find((b) => b.id === itemId);
    if (!item) throw new Error(`Backlog item not found: ${itemId}`);
    if (item.status !== 'draft') {
      // Idempotent — already-promoted items stay as they are
      return backlog;
    }
    item.status = 'promoted';
    item.promotedTaskId = taskId;
    this.saveBacklog(backlog);
    this.appendToMemory(
      item.source,
      item.projectId ?? null,
      `promoted (via form): ${item.id} ${item.title} → ${taskId}`,
    );
    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    return this.loadBacklog();
  }

  dismissItem(itemId: string, reason?: string): BacklogItem[] {
    const backlog = this.loadBacklog();
    const item = backlog.find((b) => b.id === itemId);
    if (!item) throw new Error(`Backlog item not found: ${itemId}`);
    item.status = 'dismissed';
    if (reason) item.note = reason;
    this.saveBacklog(backlog);
    this.appendToMemory(
      item.source,
      item.projectId ?? null,
      `dismissed: ${item.id} ${item.title}${reason ? ` — ${reason}` : ''}`,
    );
    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
    return this.loadBacklog();
  }

  // ─── Tick scheduling ──────────────────────────────────────────────────────

  private attachLifecycleListeners(): void {
    eventBus.on('session:created', () => this.cancelTick());
    eventBus.on('session:stage-changed', ({ to }) => {
      const idleAfter: string[] = ['done', 'failed', 'idle'];
      if (idleAfter.includes(to as string) && this.state.enabled) {
        if (!this.isRateLimited()) {
          this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
        }
      }
    });

    // Pause standby when pipeline hits a rate/usage limit
    eventBus.on('session:rate-limited', ({ retryAt }) => {
      this.onRateLimitHit(retryAt);
    });

    // Resume standby when pipeline rate limit clears
    eventBus.on('session:stage-resumed', () => {
      this.clearRateLimit();
    });
  }

  private isRateLimited(): boolean {
    if (!this.rateLimitedUntil) return false;
    return new Date(this.rateLimitedUntil).getTime() > Date.now();
  }

  private onRateLimitHit(retryAt: string): void {
    this.rateLimitedUntil = retryAt;
    this.cancelTick();
    this.killCurrentProcess();

    if (this.rateLimitResumeTimer) clearTimeout(this.rateLimitResumeTimer);

    const delayMs = new Date(retryAt).getTime() - Date.now();
    if (delayMs > 0) {
      console.log(`[StandbyScheduler] rate/usage limit — pausing until ${retryAt} (${Math.round(delayMs / 1000)}s)`);
      this.rateLimitResumeTimer = setTimeout(() => {
        this.rateLimitResumeTimer = null;
        this.clearRateLimit();
      }, delayMs);
    }
    eventBus.emit('standby:state-changed', { state: this.getState() });
  }

  private clearRateLimit(): void {
    if (!this.rateLimitedUntil) return;
    console.log('[StandbyScheduler] rate limit cleared — resuming');
    this.rateLimitedUntil = null;
    if (this.rateLimitResumeTimer) {
      clearTimeout(this.rateLimitResumeTimer);
      this.rateLimitResumeTimer = null;
    }
    if (this.state.enabled && this.isIdle()) {
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
    }
    eventBus.emit('standby:state-changed', { state: this.getState() });
  }

  private scheduleNextTick(delayMs: number): void {
    this.cancelTick();
    if (!this.state.enabled) return;
    this.state.nextTickAt = new Date(Date.now() + delayMs).toISOString();
    this.persistState();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.runTick().catch((err) => {
        console.error('[StandbyScheduler] tick failed:', err);
        this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      });
    }, delayMs);
  }

  private cancelTick(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.state.nextTickAt = null;
    this.persistState();
  }

  private isIdle(): boolean {
    const session = this.sessionManager.getSession();
    if (!session) return true;
    const terminal = ['done', 'failed', 'idle'];
    return terminal.includes(session.currentStage as string);
  }

  /**
   * Return the registered projects whose `standby.enabled === true`.
   * Order is stable (same as ProjectStore order) so the rotation index is meaningful.
   */
  private getStandbyTargets(): ProjectRecord[] {
    if (!this.projectStore) return [];
    return this.projectStore.all().filter((p) => p.standby?.enabled === true);
  }

  private async runTick(): Promise<void> {
    if (!this.state.enabled) return;

    if (this.isRateLimited()) {
      console.log('[StandbyScheduler] rate/usage limited — skipping tick');
      return;
    }

    if (!this.isIdle()) {
      console.log('[StandbyScheduler] not idle — skipping tick, retrying in 60s');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    if (this.currentProcess) {
      console.log('[StandbyScheduler] previous standby agent still running — skipping tick');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    const targets = this.getStandbyTargets();
    if (targets.length === 0) {
      console.log('[StandbyScheduler] no projects opted in (standby.enabled=true) — skipping tick');
      this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      return;
    }

    let role = STANDBY_ROLES[this.state.rotationIndex % STANDBY_ROLES.length];
    const project = targets[this.state.projectRotationIndex % targets.length];

    // baseline-fixer only makes sense when the project has a configured base branch
    // (otherwise QA never records baseline failures and the registry is empty) — skip
    // ahead to the next role to keep the rotation moving.
    if (role === 'baseline-fixer' && !project.pr?.baseBranch) {
      console.log(`[StandbyScheduler] baseline-fixer skipped for ${project.name} — no pr.baseBranch configured`);
      this.state.rotationIndex = (this.state.rotationIndex + 1) % STANDBY_ROLES.length;
      this.persistState();
      role = STANDBY_ROLES[this.state.rotationIndex % STANDBY_ROLES.length];
    }

    // Advance both rotations so over a few ticks every (role, project) combo gets coverage.
    this.state.rotationIndex = (this.state.rotationIndex + 1) % STANDBY_ROLES.length;
    this.state.projectRotationIndex = (this.state.projectRotationIndex + 1) % targets.length;
    this.state.lastTickAt = new Date().toISOString();
    this.persistState();

    eventBus.emit('standby:tick-started', { role, startedAt: this.state.lastTickAt });

    try {
      if (role === 'auto-execute') {
        await this.runAutoExecuteTick(project);
      } else {
        await this.spawnStandbyAgent(role, project);
      }
    } catch (err) {
      console.error(`[StandbyScheduler] failed to run ${role} for ${project.name}:`, err);
    } finally {
      if (this.state.enabled) {
        this.scheduleNextTick(StandbyScheduler.TICK_INTERVAL_MS);
      }
    }
  }

  // ─── Agent spawning ───────────────────────────────────────────────────────

  /**
   * Sync the project's target branch (pr.baseBranch or repo default) before analysis
   * so the standby agent always scans the latest committed code.
   */
  private async syncTargetBranch(project: ProjectRecord): Promise<void> {
    const git = new GitManager(project.path);
    const targetBranch = project.pr?.baseBranch ?? await git.getDefaultBranch();
    try {
      await git.pullBranch(targetBranch);
      console.log(`[StandbyScheduler] synced ${project.name} to ${targetBranch}`);
    } catch (err: any) {
      console.warn(`[StandbyScheduler] branch sync failed for ${project.name}/${targetBranch} — proceeding with current state: ${err.message}`);
    }
  }

  private async spawnStandbyAgent(role: StandbyRole, project: ProjectRecord): Promise<void> {
    await this.syncTargetBranch(project);

    const today = new Date().toISOString().slice(0, 10);
    const dayDir = path.join(this.standbyDir, today);
    if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeProjectSlug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || project.id.slice(0, 8);
    const outputPath = path.join(dayDir, `${role}__${safeProjectSlug}-${ts}.md`);
    const memoryPath = this.memoryPathFor(role, project.id);
    if (!fs.existsSync(memoryPath)) fs.writeFileSync(memoryPath, '', 'utf-8');

    const lastTaskId = this.findLastCompletedTaskIdForProject(project.id) ?? '';
    const manualQaContext = buildManualQaContext(project.manualQa, {
      branch: 'main',
      taskId: lastTaskId,
    });

    const baseBranch = project.pr?.baseBranch
      ?? await new GitManager(project.path).getDefaultBranch().catch(() => 'main');
    const qaBaselineRegistryPath = path.join(this.orchestraDir, 'qa-baseline', `${project.id}.json`);

    const promptTemplate = getStandbyPrompt(role);
    if (!promptTemplate) {
      console.warn(`[StandbyScheduler] no prompt template for role ${role} — skipping`);
      return;
    }
    const systemPrompt = promptTemplate
      .replaceAll('{PROJECT_PATH}', project.path)
      .replaceAll('{PROJECT_ID}', project.id)
      .replaceAll('{PROJECT_NAME}', project.name)
      .replaceAll('{MEMORY_PATH}', memoryPath)
      .replaceAll('{OUTPUT_PATH}', outputPath)
      .replaceAll('{BACKLOG_PATH}', this.backlogPath)
      .replaceAll('{LAST_TASK_ID}', lastTaskId)
      .replaceAll('{MANUAL_QA_CONTEXT}', manualQaContext)
      .replaceAll('{BASE_BRANCH}', baseBranch)
      .replaceAll('{QA_BASELINE_REGISTRY_PATH}', qaBaselineRegistryPath);

    const taskPrompt = [
      `Standby tick — role: ${role}.`,
      `Target project: ${project.name} (${project.id}) at ${project.path}.`,
      `Today: ${today}.`,
      `Set the \`projectId\` field of every BacklogItem you append to "${project.id}" and \`projectName\` to "${project.name}".`,
      `Begin your scan now.`,
    ].join('\n');

    const args = [
      '-p', taskPrompt,
      '--system-prompt', systemPrompt,
      '--model', StandbyScheduler.SCANNER_MODEL,
      '--output-format', 'stream-json',
      '--max-turns', '60',
      '--verbose',
      '--dangerously-skip-permissions',
    ];

    return new Promise<void>((resolve, reject) => {
      const child = spawn('claude', args, {
        cwd: project.path,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });
      this.currentProcess = child;
      this.currentRole = role;
      let hitRateLimit = false;
      let rateLimitMessage = '';

      const checkForRateLimit = (text: string, isStderr: boolean) => {
        if (hitRateLimit) return;
        // Only match plain-text rate-limit patterns on stderr (CLI errors),
        // not stdout where agent conversational text could false-positive.
        if (isStderr && StandbyScheduler.RATE_LIMIT_PATTERN.test(text)) {
          hitRateLimit = true;
          rateLimitMessage = text;
        }
        try {
          const data = JSON.parse(text);
          if (data.error?.type === 'rate_limit_error' || data.error?.type === 'overloaded_error') {
            hitRateLimit = true;
            rateLimitMessage = data.error?.message ?? text;
          }
        } catch { /* not JSON */ }
      };

      child.stdout?.on('data', (chunk) => { checkForRateLimit(chunk.toString(), false); });
      child.stderr?.on('data', (chunk) => {
        const text = chunk.toString();
        process.stderr.write(`[StandbyScheduler:${role}:${project.name}] ${text}`);
        checkForRateLimit(text, true);
      });

      child.on('exit', (code) => {
        this.currentProcess = null;
        this.currentRole = null;

        if (hitRateLimit) {
          console.log(`[StandbyScheduler] ${role}/${project.name} hit rate/usage limit — pausing standby`);
          const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
          this.onRateLimitHit(retryAt);
          eventBus.emit('session:rate-limited', {
            sessionId: '',
            taskId: '',
            stage: `standby:${role}`,
            retryAt,
            retryCount: 0,
            message: rateLimitMessage,
          });
          resolve();
          return;
        }

        if (code === 0) {
          console.log(`[StandbyScheduler] ${role}/${project.name} finished — output: ${outputPath}`);
          this.afterAgentExit(role, project).catch((err) =>
            console.error(`[StandbyScheduler] post-tick processing failed:`, err),
          );
          resolve();
        } else {
          console.warn(`[StandbyScheduler] ${role}/${project.name} exited with code ${code}`);
          resolve();
        }
        eventBus.emit('standby:tick-finished', { role, exitCode: code ?? 0 });
      });
      child.on('error', (err) => {
        this.currentProcess = null;
        this.currentRole = null;
        reject(err);
      });
    });
  }

  private killCurrentProcess(): void {
    if (this.currentProcess) {
      console.log(`[StandbyScheduler] killing in-flight ${this.currentRole} agent`);
      try {
        this.currentProcess.kill('SIGTERM');
      } catch { /* swallow */ }
      this.currentProcess = null;
      this.currentRole = null;
    }
  }

  /**
   * After a scanner agent exits, emit the backlog change (new items may have been added).
   */
  private async afterAgentExit(role: StandbyRole, _project: ProjectRecord): Promise<void> {
    eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });
  }

  /**
   * Dedicated auto-execute rotation tick. Picks the oldest eligible draft from
   * the backlog for the given project and creates a real pipeline task.
   *
   * Uses Sonnet 4.6 for all pipeline roles. After the task completes (tracked
   * via EventBus), updates all scanner memory files so they know what was fixed.
   *
   * Eligible criteria:
   *   - status === 'draft'
   *   - complexity === 'small'
   *   - estimatedFiles ≤ 5
   *   - scoped to the given project
   *   - title does NOT match any exclusion pattern (removal / sunsetting / dep-drop)
   */
  private async runAutoExecuteTick(project: ProjectRecord): Promise<void> {
    const candidates = this.loadBacklog().filter(
      (item) =>
        item.status === 'draft' &&
        item.complexity === 'small' &&
        (item.estimatedFiles ?? Infinity) <= 5 &&
        (item.projectId === project.id || !item.projectId) &&
        !this.isExcludedFromAutoExecute(item),
    );

    if (candidates.length === 0) {
      console.log(`[StandbyScheduler] auto-execute: no eligible candidates for ${project.name}`);
      eventBus.emit('standby:tick-finished', { role: 'auto-execute' as StandbyRole, exitCode: 0 });
      return;
    }

    const target = candidates[0];
    const autoExecModel = StandbyScheduler.AUTO_EXECUTE_MODEL;
    const models: Record<string, string> = {
      po: autoExecModel,
      architect: autoExecModel,
      'tech-lead': autoExecModel,
      developer: autoExecModel,
      qa: autoExecModel,
    };

    try {
      const session = await this.sessionManager.createTask(
        `[auto] ${target.title}`,
        target.body,
        [project.id],
        undefined,
        models,
        undefined,
        'development',
        true,   // autoApproveSpec
        true,   // autoSkipMerge
      );
      target.status = 'auto-executed';
      target.promotedTaskId = session.task.id;
      target.note = `Auto-executed by standby (${autoExecModel})`;
      target.projectId = project.id;
      target.projectName = project.name;
      this.saveBacklog(this.loadBacklog().map((i) => (i.id === target.id ? target : i)));
      this.recordAutoExecute();

      // Feed back into ALL scanner memory files for this project so next scans
      // know this issue was addressed and don't re-report it.
      const scannerRoles: StandbyRole[] = ['tech-debt-scout', 'regression-qa', 'baseline-fixer', 'feature-researcher'];
      for (const scanRole of scannerRoles) {
        this.appendToMemory(scanRole, project.id, `auto-executed: "${target.title}" → task ${session.task.id} — do not re-report this issue`);
      }

      console.log(`[StandbyScheduler] auto-executed ${target.id} → ${session.task.id} (project: ${project.name}, model: ${autoExecModel})`);
      eventBus.emit('standby:backlog-changed', { backlog: this.loadBacklog() });

      // Listen for task completion to log the outcome in scanner memory
      this.watchAutoExecuteCompletion(session.task.id, target.title, project);
    } catch (err) {
      console.error('[StandbyScheduler] auto-execute failed:', err);
      eventBus.emit('standby:tick-finished', { role: 'auto-execute' as StandbyRole, exitCode: 1 });
    }
  }

  /**
   * Watch for a specific auto-executed task to complete or fail, then update
   * scanner memory with the outcome so scanners don't re-report fixed issues.
   */
  private watchAutoExecuteCompletion(
    taskId: string,
    title: string,
    project: ProjectRecord,
  ): void {
    const onCompleted = ({ taskId: completedId }: { taskId: string }) => {
      if (completedId !== taskId) return;
      cleanup();
      const scannerRoles: StandbyRole[] = ['tech-debt-scout', 'regression-qa', 'baseline-fixer', 'feature-researcher'];
      for (const role of scannerRoles) {
        this.appendToMemory(role, project.id, `auto-execute DONE: "${title}" (${taskId}) completed successfully — issue is fixed in codebase`);
      }
    };

    const onFailed = ({ taskId: failedId, error }: { taskId: string; error: string }) => {
      if (failedId !== taskId) return;
      cleanup();
      const scannerRoles: StandbyRole[] = ['tech-debt-scout', 'regression-qa', 'baseline-fixer', 'feature-researcher'];
      for (const role of scannerRoles) {
        this.appendToMemory(role, project.id, `auto-execute FAILED: "${title}" (${taskId}) — ${error}. Issue may still be present.`);
      }
    };

    const cleanup = () => {
      eventBus.off('session:completed', onCompleted);
      eventBus.off('session:failed', onFailed);
    };

    eventBus.on('session:completed', onCompleted);
    eventBus.on('session:failed', onFailed);
  }

  /**
   * Check if a backlog item's title matches an exclusion pattern.
   * Items about removing, sunsetting, deprecating, or deleting things
   * are never auto-executed — they need human review.
   */
  private isExcludedFromAutoExecute(item: BacklogItem): boolean {
    const text = `${item.title} ${item.body}`;
    return StandbyScheduler.EXCLUDED_TITLE_PATTERNS.some((re) => re.test(text));
  }

  private recordAutoExecute(): void {
    this.state.autoExecutes.push(new Date().toISOString());
    const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
    this.state.autoExecutes = this.state.autoExecutes.filter(
      (iso) => new Date(iso).getTime() > weekAgo,
    );
    this.persistState();
  }

  // ─── Memory helpers ───────────────────────────────────────────────────────

  private memoryPathFor(role: StandbyRole, projectId: string | null): string {
    const safe = (projectId ?? 'global').replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.memoryDir, `${role}__${safe}.md`);
  }

  private appendToMemory(
    role: StandbyRole,
    projectId: string | null,
    line: string,
  ): void {
    const memoryPath = this.memoryPathFor(role, projectId);
    const stamp = new Date().toISOString();
    const entry = `- ${stamp} ${line}\n`;
    try {
      fs.appendFileSync(memoryPath, entry, 'utf-8');
      const raw = fs.readFileSync(memoryPath, 'utf-8');
      if (raw.length > 2000) {
        const lines = raw.split('\n');
        const kept = lines.slice(Math.max(0, lines.length - 50));
        fs.writeFileSync(memoryPath, kept.join('\n'), 'utf-8');
      }
    } catch (err) {
      console.error(`[StandbyScheduler] failed to update memory for ${role}/${projectId}:`, err);
    }
  }

  // ─── Persistence helpers ──────────────────────────────────────────────────

  private ensureDirs(): void {
    const qaBaselineDir = path.join(this.orchestraDir, 'qa-baseline');
    for (const dir of [this.standbyDir, this.memoryDir, qaBaselineDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
  }

  private ensureBacklogFile(): void {
    if (!fs.existsSync(this.backlogPath)) {
      fs.writeFileSync(this.backlogPath, '[]', 'utf-8');
    }
  }

  private loadState(): StandbyState {
    const defaultState: StandbyState = {
      enabled: false,
      rotationIndex: 0,
      projectRotationIndex: 0,
      lastTickAt: null,
      nextTickAt: null,
      autoExecutes: [],
    };
    try {
      if (!fs.existsSync(this.statePath)) return defaultState;
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StandbyState>;
      return {
        enabled: parsed.enabled ?? false,
        rotationIndex: parsed.rotationIndex ?? 0,
        projectRotationIndex: parsed.projectRotationIndex ?? 0,
        lastTickAt: parsed.lastTickAt ?? null,
        nextTickAt: parsed.nextTickAt ?? null,
        autoExecutes: Array.isArray(parsed.autoExecutes) ? parsed.autoExecutes : [],
      };
    } catch (err) {
      console.error('[StandbyScheduler] failed to load state, using defaults:', err);
      return defaultState;
    }
  }

  private persistState(): void {
    try {
      const tmp = `${this.statePath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8');
      fs.renameSync(tmp, this.statePath);
    } catch (err) {
      console.error('[StandbyScheduler] failed to persist state:', err);
    }
  }

  private loadBacklog(): BacklogItem[] {
    try {
      const raw = fs.readFileSync(this.backlogPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as BacklogItem[];
    } catch {
      return [];
    }
  }

  private saveBacklog(items: BacklogItem[]): void {
    let capped = items;
    if (items.length > StandbyScheduler.MAX_BACKLOG_ITEMS) {
      const sorted = [...items].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      capped = sorted.slice(0, StandbyScheduler.MAX_BACKLOG_ITEMS);
    }
    try {
      const tmp = `${this.backlogPath}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(capped, null, 2), 'utf-8');
      fs.renameSync(tmp, this.backlogPath);
    } catch (err) {
      console.error('[StandbyScheduler] failed to save backlog:', err);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  /**
   * Return the most recent completed task ID for a given project (so the
   * regression-qa role can re-validate it), or null if none.
   */
  private findLastCompletedTaskIdForProject(projectId: string): string | null {
    try {
      const history = this.sessionManager.getSessionHistory();
      const done = history.find(
        (s) => s.currentStage === 'done' && s.projectId === projectId,
      );
      return done?.task.id ?? null;
    } catch {
      return null;
    }
  }

  static newId(): string {
    return uuid();
  }
}
