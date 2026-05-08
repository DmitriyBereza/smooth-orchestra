import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import {
  PipelineStage,
  PipelineType,
  SessionState,
  SubtaskState,
  TaskDefinition,
  AgentRole,
  DEFAULT_PIPELINE,
} from '../types';
import { eventBus } from './EventBus';
import { AgentPool } from './AgentPool';
import { ArtifactManager } from './ArtifactManager';
import { GitManager } from './GitManager';
import { ProjectStore } from './ProjectStore';
import { buildSystemPrompt, buildTaskPrompt, PromptExtras } from '../prompts';
import { getPipelineConfig, PipelineTypeConfig } from '../pipelines/registry';
import { buildProjectPromptContexts, buildBaseBranchContext } from './PromptContextBuilder';
// Ensure all pipelines are registered
import '../pipelines';

/**
 * The core pipeline state machine — orchestrates pipeline flows for development,
 * marketing, and design pipeline types.
 * Manages one task at a time (MVP constraint).
 */
export class SessionManager {
  private currentSession: SessionState | null = null;
  private projectContext: string = '';
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionFilePath: string;
  private historyFilePath: string;
  private orchestraDir: string;
  /** Tracks how many times each stage has been continued after max-turns. */
  private stageContinuations = new Map<string, number>();
  private static readonly MAX_CONTINUATIONS = 3;
  private static readonly MAX_REVIEW_LOOPS = 3;

  constructor(
    private agentPool: AgentPool,
    private artifactManager: ArtifactManager,
    private gitManager: GitManager,
    private projectPath: string,
    private projectStore?: ProjectStore,
    orchestraDir?: string,
  ) {
    this.orchestraDir = orchestraDir ?? path.join(projectPath, '.orchestra');
    this.sessionFilePath = path.join(this.orchestraDir, 'session.json');
    this.historyFilePath = path.join(this.orchestraDir, 'session-history.json');
    this.loadSession();
    this.setupEventListeners();
  }

  /**
   * Set the project context string (from project.md or UI config).
   */
  setProjectContext(context: string): void {
    this.projectContext = context;
  }

  /**
   * Get the pipeline config for the current session.
   * Falls back to 'development' for backward compatibility.
   */
  private getConfig(): PipelineTypeConfig {
    const type = this.currentSession?.pipelineType ?? 'development';
    return getPipelineConfig(type);
  }

  /**
   * Persist session state to disk (atomic write).
   */
  private persistSession(): void {
    try {
      const data = JSON.stringify(this.currentSession, null, 2);
      const tmpPath = `${this.sessionFilePath}.tmp`;
      fs.writeFileSync(tmpPath, data, 'utf-8');
      fs.renameSync(tmpPath, this.sessionFilePath);
    } catch (err) {
      console.error('[SessionManager] Failed to persist session:', err);
    }
  }

  /**
   * Load session state from disk on startup.
   * Resumes non-terminal sessions at the last known stage.
   */
  private loadSession(): void {
    try {
      if (!fs.existsSync(this.sessionFilePath)) return;
      const raw = fs.readFileSync(this.sessionFilePath, 'utf-8');
      const session = JSON.parse(raw) as SessionState;

      if (!session || !session.task) return;

      // Backward compatibility: default pipelineType for old sessions
      if (!session.pipelineType) {
        session.pipelineType = 'development';
      }
      // Backward compatibility: default task.pipelineType
      if (!session.task.pipelineType) {
        session.task.pipelineType = session.pipelineType;
      }

      // Only restore non-terminal sessions
      if (this.isTerminalStage(session.currentStage)) {
        this.currentSession = session; // keep for display but don't resume
        console.log(`[SessionManager] Loaded completed session ${session.task.id} (${session.currentStage})`);
        return;
      }

      this.currentSession = session;

      // Restore project path so agents work in the correct directory
      if (session.projectPath) {
        this.projectPath = session.projectPath;
        this.gitManager = new GitManager(session.projectPath);
        console.log(`[SessionManager] Restored session ${session.task.id} at stage: ${session.currentStage} (project: ${session.projectName ?? session.projectPath})`);
      } else {
        console.log(`[SessionManager] Restored session ${session.task.id} at stage: ${session.currentStage}`);
      }

      // Resume scheduled tasks
      if (session.currentStage === 'scheduled' && session.scheduledAt) {
        const delayMs = new Date(session.scheduledAt).getTime() - Date.now();
        if (delayMs > 0) {
          console.log(`[SessionManager] Re-scheduling task to start in ${Math.round(delayMs / 1000)}s`);
          this.scheduleTimer = setTimeout(async () => {
            this.scheduleTimer = null;
            if (this.currentSession?.currentStage === 'scheduled') {
              console.log(`[SessionManager] Scheduled time reached — starting pipeline`);
              this.currentSession.scheduledAt = null;
              await this.transitionTo('po');
            }
          }, delayMs);
        } else {
          // Scheduled time already passed — start immediately
          console.log(`[SessionManager] Scheduled time already passed — starting pipeline now`);
          setTimeout(async () => {
            if (this.currentSession?.currentStage === 'scheduled') {
              this.currentSession.scheduledAt = null;
              await this.transitionTo('po');
            }
          }, 1000); // small delay to let server finish initializing
        }
        return;
      }

      // For stages waiting on user action, just keep the state — user will see it in UI
      const userActionStages: PipelineStage[] = [
        'awaiting_user_review', 'awaiting_rejection_routing', 'awaiting_merge_approval',
      ];
      if (userActionStages.includes(session.currentStage)) {
        console.log(`[SessionManager] Session waiting for user action at: ${session.currentStage}`);
        return;
      }

      // Resume rate-limited sessions — re-schedule the retry timer
      if (session.retryAt && session.rateLimitedStage) {
        const delayMs = new Date(session.retryAt).getTime() - Date.now();
        const stage = session.rateLimitedStage;
        const config = this.getConfig();
        const role = config.stageToRole[stage] ?? (stage === 'po' ? 'po' : undefined);

        if (role) {
          if (delayMs > 0) {
            console.log(`[SessionManager] Rate-limited session — retrying ${stage} in ${Math.round(delayMs / 1000)}s`);
            setTimeout(async () => {
              if (!this.currentSession || this.currentSession.currentStage === 'failed') return;
              console.log(`[SessionManager] Rate limit cleared — re-spawning ${stage}`);
              this.currentSession.retryAt = null;
              this.currentSession.rateLimitedStage = null;
              this.persistSession();
              try {
                await this.spawnAgentForStage(role as AgentRole, stage);
              } catch (err) {
                console.error(`[SessionManager] Failed to resume after rate limit:`, err);
              }
            }, delayMs);
          } else {
            // Retry time already passed — resume immediately
            console.log(`[SessionManager] Rate limit already cleared — re-spawning ${stage} now`);
            session.retryAt = null;
            session.rateLimitedStage = null;
            setTimeout(async () => {
              try {
                await this.spawnAgentForStage(role as AgentRole, stage);
              } catch (err) {
                console.error(`[SessionManager] Failed to resume after rate limit:`, err);
              }
            }, 1000);
          }
          return;
        }
      }

      // For active agent stages, the agent process died on restart.
      // Re-spawn the agent for the current stage.
      const config = this.getConfig();
      const role = config.stageToRole[session.currentStage] ?? (session.currentStage === 'po' ? 'po' : undefined);
      if (role) {
        console.log(`[SessionManager] Resuming agent for stage: ${session.currentStage} (role: ${role})`);
        setTimeout(async () => {
          try {
            await this.spawnAgentForStage(role as AgentRole, this.currentSession!.currentStage);
          } catch (err) {
            console.error(`[SessionManager] Failed to resume agent:`, err);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('[SessionManager] Failed to load session:', err);
    }
  }

  /**
   * Create a new task and start the pipeline.
   * One or more projects must be selected — agents work in those repos.
   * The first project is the "primary" (used as CWD for agents).
   * Agents handle git branching themselves — no upfront branch creation.
   */
  async createTask(
    title: string,
    description: string,
    projectIds?: string[],
    scheduledAt?: string,
    models?: Partial<Record<AgentRole, string>>,
    jiraIssueKey?: string,
    pipelineType: PipelineType = 'development',
  ): Promise<SessionState> {
    if (this.currentSession && !this.isTerminalStage(this.currentSession.currentStage)) {
      throw new Error('A task is already in progress. Complete or abort it first.');
    }

    if (!projectIds?.length || !this.projectStore) {
      throw new Error('At least one project must be selected before creating a task.');
    }

    // Resolve all projects
    const projects = projectIds.map((id) => {
      const p = this.projectStore!.findById(id);
      if (!p) throw new Error(`Project not found: ${id}`);
      return p;
    });

    // Primary project = first selected — used as CWD for agents
    const primary = projects[0];
    this.projectPath = primary.path;
    this.gitManager = new GitManager(primary.path);

    // Build multi-project context for agents
    const contextParts: string[] = [];

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      const isPrimary = i === 0;
      const header = isPrimary
        ? `### Primary Project: ${p.name} (CWD)`
        : `### Additional Project: ${p.name}`;

      contextParts.push(header);
      contextParts.push(`**Path**: ${p.path}`);
      if (p.labels.length > 0) {
        contextParts.push(`**Labels**: ${p.labels.join(', ')}`);
      }

      // AC3: inject base branch when configured
      if (isPrimary && p.pr?.baseBranch) {
        contextParts.push(buildBaseBranchContext(p.pr.baseBranch));
      }

      // Load project.md from the project if it exists
      const projectMd = path.join(p.path, '.orchestra', 'project.md');
      if (fs.existsSync(projectMd)) {
        const mdContent = fs.readFileSync(projectMd, 'utf-8');
        contextParts.push('', mdContent);
      }

      contextParts.push('');
    }

    if (projects.length > 1) {
      contextParts.push(
        '### Multi-Project Instructions',
        'This task involves multiple projects. You have access to all listed project paths.',
        'Use absolute paths when working with files outside the primary project (CWD).',
        'Create git branches as needed in any project you modify — use branch name `orchestra/{task-id}`.',
        'You decide which projects need changes based on the task requirements.',
        '',
      );
    }

    this.projectContext = contextParts.join('\n');

    const taskId = `TASK-${uuid().slice(0, 8).toUpperCase()}`;

    const task: TaskDefinition = {
      id: taskId,
      title,
      description,
      createdAt: new Date().toISOString(),
      pipelineType,
    };

    // Create task directory (artifacts stay in Orchestra's .orchestra/)
    this.artifactManager.getTaskDir(taskId);

    const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now();

    this.currentSession = {
      id: uuid(),
      task,
      currentStage: isScheduled ? 'scheduled' : 'idle',
      assignedAgents: {},
      artifacts: {},
      gitBranch: null, // agents create branches as needed
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      subtasks: [],
      scheduledAt: isScheduled ? scheduledAt : null,
      models: models ?? {},
      projectId: primary.id,
      projectName: projects.map((p) => p.name).join(', '),
      projectPath: primary.path,
      jiraIssueKey: jiraIssueKey ?? null,
      pipelineType,
    };

    this.persistSession();
    eventBus.emit('session:created', this.currentSession);

    if (isScheduled) {
      const delayMs = new Date(scheduledAt!).getTime() - Date.now();
      console.log(`[SessionManager] Task scheduled to start in ${Math.round(delayMs / 1000)}s at ${scheduledAt}`);
      this.scheduleTimer = setTimeout(async () => {
        this.scheduleTimer = null;
        if (this.currentSession?.currentStage === 'scheduled') {
          console.log(`[SessionManager] Scheduled time reached — starting pipeline`);
          this.currentSession.scheduledAt = null;
          await this.syncToBaseBranchThenStartPO(primary.id);
        }
      }, delayMs);
    } else {
      // Start the pipeline immediately
      await this.syncToBaseBranchThenStartPO(primary.id);
    }

    return this.currentSession;
  }

  /**
   * Sync the primary project to its configured target branch before spawning the PO.
   *
   * Flow:
   *  1. Look up pr.baseBranch for the given projectId — skip if absent.
   *  2. Emit git:sync-started.
   *  3. getCurrentBranch(). If already on target → skip switchBranch.
   *  4. pullBranch(target) to fast-forward.
   *  5. Update session.gitBranch to reflect actual branch.
   *  6. Emit git:sync-completed.
   *  7. On any error → log, mark session failed, emit session:failed — do NOT spawn PO.
   */
  private async syncToBaseBranchThenStartPO(projectId: string): Promise<void> {
    if (!this.currentSession) return;

    // Resolve pr.baseBranch from project config
    const project = this.projectStore?.findById(projectId);
    const baseBranch = project?.pr?.baseBranch;

    // AC5: no baseBranch configured → skip sync
    if (!baseBranch) {
      await this.transitionTo('po');
      return;
    }

    const taskId = this.currentSession.task.id;

    eventBus.emit('git:sync-started', { taskId, targetBranch: baseBranch });
    console.log(`[SessionManager] Syncing project to base branch: ${baseBranch}`);

    try {
      const currentBranch = await this.gitManager.getCurrentBranch();

      // AC3: switch only when needed
      if (currentBranch !== baseBranch) {
        console.log(`[SessionManager] Switching branch: ${currentBranch} → ${baseBranch}`);
        await this.gitManager.switchBranch(baseBranch);
      }

      // AC4: pull / fast-forward
      await this.gitManager.pullBranch(baseBranch);

      // AC8: reflect actual branch in session
      this.currentSession.gitBranch = baseBranch;
      this.persistSession();

      eventBus.emit('git:sync-completed', { taskId, branch: baseBranch });
      console.log(`[SessionManager] Branch sync complete — on ${baseBranch}`);

      await this.transitionTo('po');
    } catch (err: any) {
      // AC6: surface error, do NOT spawn PO
      const message = `Branch sync failed: ${err?.message ?? String(err)}`;
      console.error(`[SessionManager] ${message}`);

      this.currentSession.error = message;
      this.currentSession.currentStage = 'failed';
      this.currentSession.completedAt = new Date().toISOString();
      this.persistSession();
      this.archiveSession();

      eventBus.emit('session:failed', {
        sessionId: this.currentSession.id,
        taskId,
        error: message,
      });
    }
  }

  /**
   * User approves the spec — set the active pipeline and advance to its first stage.
   * If no pipeline is provided, uses the PO's proposed pipeline or the pipeline's default.
   */
  async approveSpec(pipeline?: PipelineStage[]): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }

    const config = this.getConfig();
    const defaultPipeline = config.defaultPipeline as PipelineStage[];

    const activePipeline = pipeline
      ?? this.currentSession.proposedPipeline
      ?? defaultPipeline;

    // Ensure required stage is present (e.g., developer, copywriter, ui-designer)
    if (!activePipeline.includes(config.requiredStage as PipelineStage)) {
      activePipeline.push(config.requiredStage as PipelineStage);
    }

    // Validate all stages belong to this pipeline type
    const validStages = new Set(config.allStages);
    const filteredPipeline = activePipeline.filter((s) => validStages.has(s));
    if (filteredPipeline.length === 0) {
      filteredPipeline.push(config.requiredStage as PipelineStage);
    }

    this.currentSession.activePipeline = filteredPipeline;
    this.persistSession();

    const firstStage = filteredPipeline[0] as PipelineStage;
    await this.transitionTo(firstStage);
  }

  /**
   * User rejects the spec — send back to PO with feedback to revise.
   */
  async rejectSpec(feedback: string): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }

    const taskId = this.currentSession.task.id;
    this.artifactManager.writeArtifact(taskId, 'answers',
      `# User Feedback — Spec Revision Requested\n\n${feedback}\n\nThe user has reviewed your brief and wants changes. Please revise the brief based on the feedback above.`);

    await this.transitionTo('po');
  }

  /**
   * User answers the PO's clarifying questions — send back to PO with answers.
   */
  async answerQuestions(answers: string): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }

    const taskId = this.currentSession.task.id;

    // Preserve the PO's original questions for reference
    const originalQuestions = this.artifactManager.readArtifact(taskId, 'questions');

    const answerContent = [
      `# User Answers to Clarifying Questions`,
      ``,
      ...(originalQuestions ? [`## Original Questions\n\n${originalQuestions}\n`, `---\n`] : []),
      `## Answers\n\n${answers}`,
      ``,
      `Please incorporate these answers into the brief. Do NOT ask these questions again — they have been answered above. Update story.md with the refined spec.`,
    ].join('\n');

    this.artifactManager.writeArtifact(taskId, 'answers', answerContent);

    await this.transitionTo('po');
  }

  /**
   * User approves the merge — finalize the task and auto-merge the branch.
   *
   * If the project has pr.enabled, merges the open GitHub PR via `gh pr merge`.
   * Otherwise merges the local feature branch into the target branch and pushes.
   * Merge errors are non-fatal: the task is already marked done.
   */
  async approveMerge(): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_merge_approval') {
      throw new Error('No session awaiting merge approval');
    }

    // Capture session details before transitioning (currentSession stays set but stage changes).
    // gitBranch tracks whatever branch git is currently on — after baseBranch sync it holds the
    // base (e.g. `main`), not the feature branch. Agents always create `orchestra/{taskId}`
    // (see prompts/index.ts), so derive the feature branch from the task id directly.
    const featureBranch = `orchestra/${this.currentSession.task.id}`;
    const projectPath = this.currentSession.projectPath ?? this.projectPath;
    const project = this.currentSession.projectId && this.projectStore
      ? this.projectStore.findById(this.currentSession.projectId)
      : undefined;

    this.currentSession.completedAt = new Date().toISOString();
    this.persistSession();
    await this.transitionTo('done');

    eventBus.emit('session:completed', {
      sessionId: this.currentSession.id,
      taskId: this.currentSession.task.id,
    });

    if (featureBranch) {
      this.performAutoMerge(featureBranch, projectPath, project).catch((err: any) => {
        console.error('[SessionManager] auto-merge failed (task is done, branch may need manual merge):', err.message);
      });
    }
  }

  /**
   * Merge the feature branch into the target branch after the user approves.
   * Runs after the session is already marked done, so errors are non-blocking.
   */
  private async performAutoMerge(
    featureBranch: string,
    projectPath: string,
    project: import('../types/project').ProjectRecord | undefined,
  ): Promise<void> {
    const git = new GitManager(projectPath);
    const targetBranch = project?.pr?.baseBranch ?? await git.getDefaultBranch();

    if (project?.pr?.enabled) {
      console.log(`[SessionManager] merging PR for branch ${featureBranch} via gh CLI`);
      await git.mergeGithubPR(featureBranch);
    } else {
      console.log(`[SessionManager] merging ${featureBranch} → ${targetBranch} locally`);
      await git.mergeLocalAndPush(featureBranch, targetBranch);
    }
    console.log(`[SessionManager] auto-merge of ${featureBranch} completed`);
  }

  /**
   * User rejects the merge — send back to the pipeline's "doer" role with feedback.
   */
  async rejectMerge(feedback: string): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_merge_approval') {
      throw new Error('No session awaiting merge approval');
    }

    const taskId = this.currentSession.task.id;
    this.artifactManager.writeArtifact(taskId, 'questions',
      `# Merge Review Feedback\n\n${feedback}\n\nPlease address these issues.`);

    // Send back to the required stage (developer / copywriter / ui-designer)
    const config = this.getConfig();
    await this.transitionTo(config.requiredStage as PipelineStage);
  }

  /**
   * Abort the current task (also cancels scheduled tasks).
   */
  async abortTask(): Promise<void> {
    if (!this.currentSession) return;

    // Cancel pending schedule timer
    if (this.scheduleTimer) {
      clearTimeout(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    this.agentPool.killAll();

    const session = this.currentSession;
    session.currentStage = 'failed';
    session.error = 'Aborted by user';
    session.completedAt = new Date().toISOString();
    this.persistSession();

    eventBus.emit('session:failed', {
      sessionId: session.id,
      taskId: session.task.id,
      error: 'Aborted by user',
    });
  }

  /**
   * Get the current session state.
   */
  getSession(): SessionState | null {
    return this.currentSession;
  }

  /**
   * Get session history (completed/failed sessions).
   */
  getSessionHistory(): SessionState[] {
    try {
      if (!fs.existsSync(this.historyFilePath)) return [];
      const raw = fs.readFileSync(this.historyFilePath, 'utf-8');
      return JSON.parse(raw) as SessionState[];
    } catch {
      return [];
    }
  }

  /**
   * Archive the current session to history when it reaches a terminal state.
   */
  private archiveSession(): void {
    if (!this.currentSession) return;
    try {
      const history = this.getSessionHistory();
      // Avoid duplicates
      if (!history.some(s => s.id === this.currentSession!.id)) {
        history.unshift(this.currentSession);
      }
      // Keep last 50 sessions
      const trimmed = history.slice(0, 50);
      const tmpPath = `${this.historyFilePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(trimmed, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.historyFilePath);
    } catch (err) {
      console.error('[SessionManager] Failed to archive session:', err);
    }
  }

  /**
   * Get artifacts list for a task (names + file paths).
   */
  getTaskArtifacts(taskId: string): { name: string; path: string }[] {
    return this.artifactManager.listArtifacts(taskId).map(a => ({
      name: a.type,
      path: a.path,
    }));
  }

  /**
   * Transition the pipeline to a new stage.
   */
  private async transitionTo(stage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;

    const from = this.currentSession.currentStage;
    this.currentSession.currentStage = stage;
    this.persistSession();

    // Archive to history when reaching a terminal state
    if (this.isTerminalStage(stage)) {
      this.archiveSession();
    }

    eventBus.emit('session:stage-changed', {
      sessionId: this.currentSession.id,
      from,
      to: stage,
    });

    // Parallel dev stage has its own spawning logic (development pipeline only)
    if (stage === 'parallel-dev') {
      await this.spawnParallelDevelopers();
      return;
    }

    // PO always uses 'po' role
    if (stage === 'po') {
      await this.spawnAgentForStage('po', stage);
      return;
    }

    // Use pipeline config to resolve the role for this stage
    const config = this.getConfig();
    const role = config.stageToRole[stage] as AgentRole | undefined;
    if (role) {
      await this.spawnAgentForStage(role, stage);
    }
  }

  /**
   * Build per-spawn prompt extras (manualQa / pr blocks) from the primary
   * project's config. Only the QA stage gets manualQaContext; only the
   * developer stage gets prContext — every other role gets an empty string
   * so the placeholders silently disappear.
   */
  private buildPromptExtras(role: AgentRole): PromptExtras {
    if (!this.currentSession) return {};
    const projectId = this.currentSession.projectId;
    const project = projectId && this.projectStore
      ? this.projectStore.findById(projectId)
      : undefined;
    const branch = `orchestra/${this.currentSession.task.id}`;
    const qaBaselineRegistryPath = projectId
      ? path.join(this.orchestraDir, 'qa-baseline', `${projectId}.json`)
      : undefined;
    const values = {
      branch,
      taskId: this.currentSession.task.id,
      title: this.currentSession.task.title,
      qaBaselineRegistryPath,
    };
    const { manualQaContext, prContext, qaBaselineContext } = buildProjectPromptContexts(project, values);
    return {
      manualQaContext: role === 'qa' ? manualQaContext : '',
      prContext: role === 'developer' ? prContext : '',
      qaBaselineContext: role === 'qa' ? qaBaselineContext : '',
    };
  }

  /**
   * Spawn an agent for the current pipeline stage.
   */
  private async spawnAgentForStage(role: AgentRole, stage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;

    const taskId = this.currentSession.task.id;
    const { title, description } = this.currentSession.task;
    const pipelineType = this.currentSession.pipelineType ?? 'development';

    // Absolute path to this task's artifact directory — agents must use this
    const artifactDir = this.artifactManager.getTaskDir(taskId);

    // Build context from previous stage artifacts
    const artifactContext = this.artifactManager.buildContextForRole(taskId, role, stage);

    // Build per-stage prompt extras (manual QA URLs, auto-PR config)
    const extras = this.buildPromptExtras(role);

    // Build prompts — pass pipelineType for PO and domain-specific roles
    const systemPrompt = buildSystemPrompt(role, this.projectContext, stage, artifactDir, pipelineType, extras);
    const taskPrompt = buildTaskPrompt(role, taskId, title, description, artifactContext, stage, undefined, artifactDir);

    // Create and start the agent
    const agent = this.agentPool.createAgent(role, taskId);
    this.currentSession.assignedAgents[role] = agent.id;
    this.persistSession();

    const modelForRole = this.currentSession.models?.[role] || undefined;
    await agent.start(systemPrompt, taskPrompt, this.projectPath, modelForRole);
  }

  /**
   * Resume an agent for the current stage using a previous session ID.
   * Used when the agent hit max-turns and needs to continue from where it left off.
   */
  private async resumeAgentForStage(role: AgentRole, stage: PipelineStage, resumeSessionId: string): Promise<void> {
    if (!this.currentSession) return;

    const taskId = this.currentSession.task.id;
    const agent = this.agentPool.createAgent(role, taskId);
    this.currentSession.assignedAgents[role] = agent.id;
    this.persistSession();

    const modelForRole = this.currentSession.models?.[role] || undefined;
    // Pass empty strings for prompts — they're ignored when resumeSessionId is set
    await agent.start('', '', this.projectPath, modelForRole, resumeSessionId);
  }

  /**
   * Set up event listeners for pipeline progression.
   */
  private setupEventListeners(): void {
    eventBus.on('agent:exited', async ({ role, exitCode, taskId, agentId }) => {
      if (!this.currentSession || this.currentSession.task.id !== taskId) return;

      const stage = this.currentSession.currentStage;

      // Handle parallel dev completion (development pipeline only)
      if (stage === 'parallel-dev' && role === 'developer') {
        const subtask = this.currentSession.subtasks.find(s => s.assignedAgentId === agentId);
        if (!subtask) return;

        if (exitCode === 0) {
          subtask.status = 'completed';
          this.persistSession();
          eventBus.emit('session:subtask-completed', {
            taskId,
            subtaskId: subtask.id,
            agentId: agentId || '',
          });
        } else {
          subtask.status = 'failed';
          this.persistSession();
          eventBus.emit('session:subtask-failed', {
            taskId,
            subtaskId: subtask.id,
            agentId: agentId || '',
            error: `Exit code ${exitCode}`,
          });
        }

        // Check if ALL subtasks are done
        const allDone = this.currentSession.subtasks.every(
          s => s.status === 'completed' || s.status === 'failed',
        );
        if (allDone) {
          const anyFailed = this.currentSession.subtasks.some(s => s.status === 'failed');
          if (anyFailed) {
            this.currentSession.error = 'One or more subtasks failed';
            await this.transitionTo('failed');
          } else {
            const config = this.getConfig();
            eventBus.emit('session:all-subtasks-completed', { taskId });
            // Advance to next stage after developer in activePipeline
            await this.advancePipeline('developer');
          }
        }
        return;
      }

      // Original linear handler for non-parallel stages
      const config = this.getConfig();
      const expectedRole = stage === 'po' ? 'po' : (config.stageToRole[stage] as AgentRole | undefined);

      if (role !== expectedRole) return;

      if (exitCode !== 0) {
        const agent = this.agentPool.getAgentById(agentId || '');

        // Check if this was a rate-limit exit — schedule retry instead of failing
        if (agent?.rateLimited && agent.lastSessionId) {
          const retryMs = agent.rateLimitRetryMs ?? 5 * 60_000;
          const retryAt = new Date(Date.now() + retryMs).toISOString();
          const retryCount = (this.currentSession.rateLimitRetries ?? 0) + 1;

          console.log(`[SessionManager] Rate limit hit for ${stage} — scheduling retry #${retryCount} at ${retryAt} (${Math.round(retryMs / 1000)}s)`);

          this.currentSession.retryAt = retryAt;
          this.currentSession.rateLimitedStage = stage;
          this.currentSession.rateLimitRetries = retryCount;
          this.persistSession();

          eventBus.emit('session:rate-limited', {
            sessionId: this.currentSession.id,
            taskId,
            stage,
            retryAt,
            retryCount,
            message: agent.rateLimitMessage,
          });

          // Schedule the retry
          const sessionId = agent.lastSessionId;
          setTimeout(async () => {
            if (!this.currentSession || this.currentSession.task.id !== taskId) return;
            if (this.currentSession.currentStage === 'failed') return; // user aborted

            console.log(`[SessionManager] Rate limit retry — resuming ${stage} (session: ${sessionId})`);
            this.currentSession.retryAt = null;
            this.currentSession.rateLimitedStage = null;
            this.persistSession();

            eventBus.emit('session:stage-resumed', {
              sessionId: this.currentSession.id,
              stage,
            });

            try {
              await this.resumeAgentForStage(role, stage, sessionId);
            } catch (err) {
              console.error(`[SessionManager] Failed to resume after rate limit:`, err);
            }
          }, retryMs);

          return;
        }

        // Check if this was a max-turns exit — if so, resume instead of failing
        if (agent?.maxTurnsReached && agent.lastSessionId) {
          const continuationKey = `${this.currentSession.id}:${stage}`;
          const count = this.stageContinuations.get(continuationKey) ?? 0;

          if (count < SessionManager.MAX_CONTINUATIONS) {
            this.stageContinuations.set(continuationKey, count + 1);
            const sessionId = agent.lastSessionId;
            console.log(`[SessionManager] Max-turns hit for ${stage} — resuming session ${sessionId} (continuation ${count + 1}/${SessionManager.MAX_CONTINUATIONS})`);

            eventBus.emit('session:stage-continued', {
              sessionId: this.currentSession.id,
              stage,
              continuation: count + 1,
            });

            await this.resumeAgentForStage(role, stage, sessionId);
            return;
          }

          console.warn(`[SessionManager] Max continuations (${SessionManager.MAX_CONTINUATIONS}) reached for stage ${stage} — marking failed`);
        }

        // Agent failed — halt pipeline
        this.currentSession.error = `Agent ${role} exited with code ${exitCode}`;
        await this.transitionTo('failed');

        eventBus.emit('session:failed', {
          sessionId: this.currentSession.id,
          taskId,
          error: this.currentSession.error,
        });
        return;
      }

      // Agent completed successfully — reset continuation counter and advance
      this.stageContinuations.delete(`${this.currentSession.id}:${stage}`);
      await this.advancePipeline(stage);
    });

    // Handle user commands from the frontend
    eventBus.on('command:create-task', async ({
      title,
      description,
      projectIds,
      scheduledAt,
      models,
      jiraIssueKey,
      pipelineType,
    }: {
      title: string;
      description: string;
      projectIds?: string[];
      scheduledAt?: string;
      models?: Partial<Record<AgentRole, string>>;
      jiraIssueKey?: string;
      pipelineType?: PipelineType;
    }) => {
      console.log(`[SessionManager] Received create-task: "${title}" (projects: ${projectIds?.join(', ') ?? 'none'}, pipeline: ${pipelineType ?? 'development'}, scheduled: ${scheduledAt ?? 'now'}, jira: ${jiraIssueKey ?? 'none'})`);
      try {
        await this.createTask(title, description, projectIds, scheduledAt, models, jiraIssueKey, pipelineType ?? 'development');
      } catch (err: any) {
        console.error('[SessionManager] Failed to create task:', err.message, err.stack);
      }
    });

    eventBus.on('command:approve-spec', async ({ pipeline }: { pipeline?: PipelineStage[] }) => {
      try {
        await this.approveSpec(pipeline);
      } catch (err: any) {
        console.error('Failed to approve spec:', err.message);
      }
    });

    eventBus.on('command:reject-spec', async ({ feedback }) => {
      try {
        await this.rejectSpec(feedback);
      } catch (err: any) {
        console.error('Failed to reject spec:', err.message);
      }
    });

    eventBus.on('command:answer-questions', async ({ answers }: { answers: string }) => {
      try {
        await this.answerQuestions(answers);
      } catch (err: any) {
        console.error('Failed to answer questions:', err.message);
      }
    });

    eventBus.on('command:abort-task', async () => {
      try {
        await this.abortTask();
      } catch (err: any) {
        console.error('Failed to abort task:', err.message);
      }
    });

    eventBus.on('command:route-rejection', async ({ sessionId, routing }) => {
      if (!this.currentSession || this.currentSession.id !== sessionId) return;
      if (this.currentSession.currentStage !== 'awaiting_rejection_routing') return;

      try {
        const config = this.getConfig();
        const taskId = this.currentSession.task.id;

        if (routing === 'send_to_dev') {
          // Read QA report artifact (different name per pipeline type)
          const qaStage = config.qaStage;
          const qaArtifacts = qaStage ? config.stageArtifacts[qaStage]?.writes ?? [] : [];
          const qaReportType = qaArtifacts[0]; // first written artifact is the QA report
          const qaReport = qaReportType
            ? this.artifactManager.readArtifact(taskId, qaReportType)
            : null;

          this.artifactManager.writeArtifact(
            taskId,
            'questions',
            `# QA Rejection Feedback\n\n${qaReport ?? ''}\n\nPlease fix the issues identified above.`,
          );
          // Send back to required stage (developer / copywriter / ui-designer)
          await this.transitionTo(config.requiredStage as PipelineStage);
        } else if (routing === 'escalate_to_po') {
          this.currentSession.qaDecision = null;
          this.currentSession.rejectionReason = null;
          await this.transitionTo('po');
        }
      } catch (err: any) {
        console.error('Failed to route rejection:', err.message);
      }
    });

    eventBus.on('command:approve-merge', async (_data) => {
      try {
        await this.approveMerge();
      } catch (err: any) {
        console.error('Failed to approve merge:', err.message);
      }
    });

    eventBus.on('command:reject-merge', async ({ feedback }) => {
      try {
        await this.rejectMerge(feedback);
      } catch (err: any) {
        console.error('Failed to reject merge:', err.message);
      }
    });
  }

  /**
   * Advance the pipeline to the next stage after an agent completes.
   * Uses activePipeline for dynamic routing; handles review loopback via config.
   */
  private async advancePipeline(completedStage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;
    const taskId = this.currentSession.task.id;
    const config = this.getConfig();

    // PO always transitions to awaiting_user_review (pipeline not set yet)
    if (completedStage === 'po') {
      const pipelineContent = this.artifactManager.readArtifact(taskId, 'pipeline');
      if (pipelineContent) {
        this.currentSession.proposedPipeline = this.parsePipelineArtifact(pipelineContent);
        this.persistSession();
      }
      await this.transitionTo('awaiting_user_review');
      return;
    }

    // Check if this is a review stage with potential loopback
    const reviewConfig = config.reviewStages.find(r => r.stage === completedStage);
    if (reviewConfig) {
      const reviewContent = this.artifactManager.readArtifact(taskId, reviewConfig.decisionArtifact);
      const decision = reviewContent ? this.parseArtifactDecision(reviewContent) : null;

      if (decision === 'CHANGES_REQUESTED') {
        const loopCount = (this.currentSession.reviewLoopCount ?? 0) + 1;
        this.currentSession.reviewLoopCount = loopCount;
        this.persistSession();

        if (loopCount >= SessionManager.MAX_REVIEW_LOOPS) {
          console.warn(`[SessionManager] Review loop limit reached (${loopCount}/${SessionManager.MAX_REVIEW_LOOPS}) — advancing despite CHANGES_REQUESTED`);
          // Fall through to normal advancement instead of looping back
        } else {
          console.log(`[SessionManager] Review requested changes — looping back to ${reviewConfig.rejectTarget} (loop ${loopCount}/${SessionManager.MAX_REVIEW_LOOPS})`);
          await this.transitionTo(reviewConfig.rejectTarget);
          return;
        }
      }
      // If approved (or loop limit reached), fall through to normal advancement
    }

    // Check if this is the QA stage — handle rejection routing
    if (completedStage === config.qaStage) {
      const qaArtifacts = config.stageArtifacts[completedStage as string]?.writes ?? [];
      const qaReportType = qaArtifacts[0]; // first written artifact is the QA report
      const qaReport = qaReportType
        ? this.artifactManager.readArtifact(taskId, qaReportType)
        : null;
      const decision = qaReport ? this.parseArtifactDecision(qaReport) : null;

      if (decision === 'REJECTED' || decision === 'FAIL') {
        this.currentSession.qaDecision = 'rejected';
        const reason = this.extractRejectionReason(qaReport!);
        this.currentSession.rejectionReason = reason;
        eventBus.emit('session:qa-rejection', {
          sessionId: this.currentSession.id,
          taskId,
          reason,
        });
        await this.transitionTo('awaiting_rejection_routing');
      } else {
        this.currentSession.qaDecision = 'approved';
        await this.transitionTo('awaiting_merge_approval');
      }
      return;
    }

    // Normal: find next stage in activePipeline
    const pipeline = this.currentSession.activePipeline ?? (config.defaultPipeline as PipelineStage[]);
    const idx = pipeline.indexOf(completedStage);
    const nextStage = (idx !== -1 && idx < pipeline.length - 1)
      ? pipeline[idx + 1] as PipelineStage
      : 'awaiting_merge_approval';

    // developer might become parallel-dev if multiple subtasks were planned (development pipeline only)
    if (nextStage === 'developer' && config.supportsParallelExecution) {
      const devTasksContent = this.artifactManager.readArtifact(taskId, 'dev-tasks');
      const parsed = devTasksContent ? this.parseDevTasks(devTasksContent) : [];
      if (parsed.length > 1) {
        await this.transitionTo('parallel-dev');
        return;
      }
    }

    await this.transitionTo(nextStage);
  }

  /**
   * Parse the PO's pipeline.md artifact into an ordered list of pipeline stages.
   * Validates against the current session's pipeline type's valid stages.
   */
  private parsePipelineArtifact(content: string): PipelineStage[] {
    const config = this.getConfig();
    const validStagesSet = new Set(config.allStages);
    const defaultPipeline = config.defaultPipeline as PipelineStage[];

    const stagesMatch = content.match(/## Stages\n([\s\S]*?)(?=\n##|$)/);
    if (!stagesMatch) return defaultPipeline;

    const lines = stagesMatch[1].trim().split('\n');
    const stages: PipelineStage[] = [];

    for (const line of lines) {
      const match = line.match(/^[-*]\s+(\S+)/);
      if (match) {
        const stage = match[1].trim() as PipelineStage;
        if (validStagesSet.has(stage)) {
          stages.push(stage);
        }
      }
    }

    // Always ensure required stage is present
    if (!stages.includes(config.requiredStage as PipelineStage)) {
      stages.push(config.requiredStage as PipelineStage);
    }

    return stages.length > 0 ? stages : defaultPipeline;
  }

  private parseArtifactDecision(content: string): string | null {
    const match = content.match(/##\s*(?:Decision|Verdict):\s*(\w+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  private extractRejectionReason(content: string): string {
    const reasonMatch = content.match(/##?\s*(?:Reason|Issues|Problems)[:\s]*\n([\s\S]*?)(?=\n##|\n$|$)/i);
    if (reasonMatch) return reasonMatch[1].trim().slice(0, 500);

    const decisionIdx = content.search(/##\s*(?:Decision|Verdict):/i);
    if (decisionIdx !== -1) {
      const afterDecision = content.slice(decisionIdx).split('\n').slice(1).join('\n').trim();
      return afterDecision.slice(0, 500) || 'QA rejected (no details provided)';
    }

    return 'QA rejected (no details provided)';
  }

  /**
   * Parse dev-tasks.md and spawn parallel developer agents.
   * Called when transitioning to the 'parallel-dev' stage.
   */
  private async spawnParallelDevelopers(): Promise<void> {
    if (!this.currentSession) return;
    const taskId = this.currentSession.task.id;

    // Parse dev-tasks.md into subtasks
    const devTasksContent = this.artifactManager.readArtifact(taskId, 'dev-tasks');
    if (!devTasksContent) {
      // Fallback: treat as single dev task (backward compatible)
      await this.spawnAgentForStage('developer', 'developer');
      return;
    }

    const subtasks = this.parseDevTasks(devTasksContent);

    if (subtasks.length === 0) {
      // No subtasks found, fall back to single developer
      await this.spawnAgentForStage('developer', 'developer');
      return;
    }

    // Create SubtaskState entries
    this.currentSession.subtasks = subtasks.map((st, i) => ({
      id: `subtask-${i + 1}`,
      index: i + 1,
      parentTaskId: taskId,
      title: st.title,
      status: 'pending' as const,
      assignedAgentId: null,
      gitBranch: `${this.currentSession!.gitBranch}/dev-${i + 1}`,
      files: st.files,
    }));

    // Build shared prompt context once (identical across subtasks)
    const artifactDir = this.artifactManager.getTaskDir(taskId);
    const artifactContext = this.artifactManager.buildContextForRole(taskId, 'developer');
    const extras = this.buildPromptExtras('developer');
    const systemPrompt = buildSystemPrompt('developer', this.projectContext, undefined, artifactDir, 'development', extras);

    // Spawn a developer agent for each subtask
    for (const subtask of this.currentSession.subtasks) {
      try {
        const taskPrompt = this.buildSubtaskPrompt(taskId, subtask, artifactContext, artifactDir);

        const agent = this.agentPool.createAgent('developer', taskId);
        subtask.assignedAgentId = agent.id;
        subtask.status = 'in_progress';

        eventBus.emit('session:subtask-started', {
          taskId,
          subtaskId: subtask.id,
          agentId: agent.id,
        });

        const devModel = this.currentSession.models?.['developer'] || undefined;
        await agent.start(systemPrompt, taskPrompt, this.projectPath, devModel);
      } catch (err: any) {
        subtask.status = 'failed';
        console.error(`Failed to spawn dev for subtask ${subtask.id}:`, err);
      }
    }
  }

  /**
   * Build a prompt for a specific subtask assignment.
   */
  private buildSubtaskPrompt(
    taskId: string,
    subtask: SubtaskState,
    artifactContext: string,
    artifactDir?: string,
  ): string {
    const dir = artifactDir ?? `.orchestra/tasks/${taskId}`;
    return [
      `# Task Assignment — Subtask ${subtask.index}`,
      ``,
      `**Task ID**: ${taskId}`,
      `**Subtask**: ${subtask.title}`,
      `**Your assigned files**: ${subtask.files.join(', ') || 'See dev-tasks.md'}`,
      `**Your git branch**: ${subtask.gitBranch}`,
      ``,
      `IMPORTANT: Only modify files assigned to you. Other files are locked by other developers.`,
      `Write your dev-notes to: ${dir}/dev-notes-${subtask.index}.md`,
      `Write your QA spec to: ${dir}/qa-spec-${subtask.index}.md`,
      ``,
      `# Context from Previous Stages`,
      ``,
      artifactContext,
      ``,
      `Please begin implementing your assigned subtask now.`,
    ].join('\n');
  }

  /**
   * Simple parser for dev-tasks.md content.
   * Expects sections delimited by "## Dev Task N:" headings.
   */
  private parseDevTasks(content: string): Array<{ title: string; files: string[]; description: string }> {
    const tasks: Array<{ title: string; files: string[]; description: string }> = [];
    const sections = content.split(/^## Dev Task \d+:/m).slice(1);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const title = lines[0]?.trim() || 'Untitled';

      let files: string[] = [];
      let description = '';

      for (const line of lines.slice(1)) {
        const filesMatch = line.match(/^\*?\*?Files\*?\*?:\s*(.+)/i);
        if (filesMatch) {
          files = filesMatch[1].split(',').map(f => f.trim()).filter(Boolean);
          continue;
        }
        const descMatch = line.match(/^\*?\*?Description\*?\*?:\s*(.+)/i);
        if (descMatch) {
          description = descMatch[1].trim();
          continue;
        }
      }

      tasks.push({ title, files, description });
    }

    return tasks;
  }

  private isTerminalStage(stage: PipelineStage): boolean {
    return stage === 'done' || stage === 'failed';
  }
}
