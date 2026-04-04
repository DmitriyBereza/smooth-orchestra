import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import {
  PipelineStage,
  SessionState,
  SubtaskState,
  TaskDefinition,
  STAGE_TO_ROLE,
  getNextStage,
  AgentRole,
  DEFAULT_PIPELINE,
  PIPELINE_STAGES,
} from '../types';
import { eventBus } from './EventBus';
import { AgentPool } from './AgentPool';
import { ArtifactManager } from './ArtifactManager';
import { GitManager } from './GitManager';
import { ProjectStore } from './ProjectStore';
import { buildSystemPrompt, buildTaskPrompt } from '../prompts';

/**
 * The core pipeline state machine — orchestrates the PO → Architect → Tech Lead → Dev → QA flow.
 * Manages one task at a time (MVP constraint).
 */
export class SessionManager {
  private currentSession: SessionState | null = null;
  private projectContext: string = '';
  private scheduleTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionFilePath: string;
  private orchestraDir: string;
  /** Tracks how many times each stage has been continued after max-turns. */
  private stageContinuations = new Map<string, number>();
  private static readonly MAX_CONTINUATIONS = 3;

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

      // For active agent stages, the agent process died on restart.
      // Re-spawn the agent for the current stage.
      const role = STAGE_TO_ROLE[session.currentStage];
      if (role) {
        console.log(`[SessionManager] Resuming agent for stage: ${session.currentStage} (role: ${role})`);
        setTimeout(async () => {
          try {
            await this.spawnAgentForStage(role, this.currentSession!.currentStage);
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
  async createTask(title: string, description: string, projectIds?: string[], scheduledAt?: string, models?: Partial<Record<AgentRole, string>>, jiraIssueKey?: string): Promise<SessionState> {
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
    };

    // Create task directory (artifacts stay in Orchestra's .orchestra/)
    this.artifactManager.getTaskDir(taskId);

    // No upfront branch creation — agents handle git themselves based on which projects they modify

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
          await this.transitionTo('po');
        }
      }, delayMs);
    } else {
      // Start the pipeline immediately
      await this.transitionTo('po');
    }

    return this.currentSession;
  }

  /**
   * User approves the spec — set the active pipeline and advance to its first stage.
   * If no pipeline is provided, uses the PO's proposed pipeline or the full default.
   */
  async approveSpec(pipeline?: PipelineStage[]): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }

    const activePipeline = pipeline
      ?? this.currentSession.proposedPipeline
      ?? DEFAULT_PIPELINE;

    // Always ensure developer is present
    if (!activePipeline.includes('developer')) {
      activePipeline.push('developer');
    }

    this.currentSession.activePipeline = activePipeline;
    this.persistSession();

    const firstStage = activePipeline[0] as PipelineStage;
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
      `# User Feedback — Spec Revision Requested\n\n${feedback}\n\nThe user has reviewed your story and wants changes. Please revise the story based on the feedback above.`);

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
      `Please incorporate these answers into the user story. Do NOT ask these questions again — they have been answered above. Update story.md with the refined spec.`,
    ].join('\n');

    this.artifactManager.writeArtifact(taskId, 'answers', answerContent);

    await this.transitionTo('po');
  }

  /**
   * User approves the merge — finalize the task.
   */
  async approveMerge(): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_merge_approval') {
      throw new Error('No session awaiting merge approval');
    }

    // Agents handle branches themselves — merge is manual or handled by the developer agent
    this.currentSession.completedAt = new Date().toISOString();
    this.persistSession();
    await this.transitionTo('done');

    eventBus.emit('session:completed', {
      sessionId: this.currentSession.id,
      taskId: this.currentSession.task.id,
    });
  }

  /**
   * User rejects the merge — send back to developer with feedback.
   */
  async rejectMerge(feedback: string): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_merge_approval') {
      throw new Error('No session awaiting merge approval');
    }

    const taskId = this.currentSession.task.id;
    this.artifactManager.writeArtifact(taskId, 'questions',
      `# Merge Review Feedback\n\n${feedback}\n\nPlease address these issues.`);

    await this.transitionTo('developer');
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
   * Transition the pipeline to a new stage.
   */
  private async transitionTo(stage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;

    const from = this.currentSession.currentStage;
    this.currentSession.currentStage = stage;
    this.persistSession();

    eventBus.emit('session:stage-changed', {
      sessionId: this.currentSession.id,
      from,
      to: stage,
    });

    // Parallel dev stage has its own spawning logic
    if (stage === 'parallel-dev') {
      await this.spawnParallelDevelopers();
      return;
    }

    // If this stage has an associated agent role, spawn it
    const role = STAGE_TO_ROLE[stage];
    if (role) {
      await this.spawnAgentForStage(role, stage);
    }
  }

  /**
   * Spawn an agent for the current pipeline stage.
   */
  private async spawnAgentForStage(role: AgentRole, stage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;

    const taskId = this.currentSession.task.id;
    const { title, description } = this.currentSession.task;

    // Absolute path to this task's artifact directory — agents must use this
    // so they write to Orchestra's .orchestra/ dir, not their CWD project's .orchestra/
    const artifactDir = this.artifactManager.getTaskDir(taskId);

    // Build context from previous stage artifacts
    const artifactContext = this.artifactManager.buildContextForRole(taskId, role, stage);

    // Build prompts
    const systemPrompt = buildSystemPrompt(role, this.projectContext, stage, artifactDir);
    const taskPrompt = buildTaskPrompt(role, taskId, title, description, artifactContext, stage, undefined, artifactDir);

    // Create and start the agent
    const agent = this.agentPool.createAgent(role, taskId);
    this.currentSession.assignedAgents[role] = agent.id;

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

      // Handle parallel dev completion
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
            eventBus.emit('session:all-subtasks-completed', { taskId });
            await this.transitionTo('qa');
          }
        }
        return;
      }

      // Original linear handler for non-parallel stages
      const expectedRole = STAGE_TO_ROLE[stage];

      if (role !== expectedRole) return;

      if (exitCode !== 0) {
        // Check if this was a max-turns exit — if so, resume instead of failing
        const agent = this.agentPool.getAgentById(agentId || '');
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
    eventBus.on('command:create-task', async ({ title, description, projectIds, scheduledAt, models, jiraIssueKey }: { title: string; description: string; projectIds?: string[]; scheduledAt?: string; models?: Partial<Record<AgentRole, string>>; jiraIssueKey?: string }) => {
      console.log(`[SessionManager] Received create-task: "${title}" (projects: ${projectIds?.join(', ') ?? 'none'}, scheduled: ${scheduledAt ?? 'now'}, jira: ${jiraIssueKey ?? 'none'})`);
      try {
        await this.createTask(title, description, projectIds, scheduledAt, models, jiraIssueKey);
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
        if (routing === 'send_to_dev') {
          const taskId = this.currentSession.task.id;
          const qaReport = this.artifactManager.readArtifact(taskId, 'qa-report');
          this.artifactManager.writeArtifact(
            taskId,
            'questions',
            `# QA Rejection Feedback\n\n${qaReport ?? ''}\n\nPlease fix the issues identified above.`,
          );
          await this.transitionTo('developer');
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
   * Uses activePipeline for dynamic routing; handles special loopback cases.
   */
  private async advancePipeline(completedStage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;
    const taskId = this.currentSession.task.id;

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

    // TL code review: might loop back to developer
    if (completedStage === 'tl-code-review') {
      await this.handleCodeReviewDecision();
      return;
    }

    // QA: might reject
    if (completedStage === 'qa') {
      const qaReport = this.artifactManager.readArtifact(taskId, 'qa-report');
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
    const pipeline = this.currentSession.activePipeline ?? DEFAULT_PIPELINE;
    const idx = pipeline.indexOf(completedStage);
    const nextStage = (idx !== -1 && idx < pipeline.length - 1)
      ? pipeline[idx + 1] as PipelineStage
      : 'awaiting_merge_approval';

    // developer might become parallel-dev if multiple subtasks were planned
    if (nextStage === 'developer') {
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
   */
  private parsePipelineArtifact(content: string): PipelineStage[] {
    const stagesMatch = content.match(/## Stages\n([\s\S]*?)(?=\n##|$)/);
    if (!stagesMatch) return DEFAULT_PIPELINE;

    const lines = stagesMatch[1].trim().split('\n');
    const stages: PipelineStage[] = [];

    for (const line of lines) {
      const match = line.match(/^[-*]\s+(\S+)/);
      if (match) {
        const stage = match[1].trim() as PipelineStage;
        if (PIPELINE_STAGES.includes(stage)) {
          stages.push(stage);
        }
      }
    }

    // Always ensure developer is present
    if (!stages.includes('developer')) {
      stages.push('developer');
    }

    return stages.length > 0 ? stages : DEFAULT_PIPELINE;
  }

  private parseArtifactDecision(content: string): string | null {
    const match = content.match(/##\s*(?:Decision|Verdict):\s*(\w+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Handle the TL code review decision — approve to next stage or loop back to developer.
   */
  private async handleCodeReviewDecision(): Promise<void> {
    if (!this.currentSession) return;

    const taskId = this.currentSession.task.id;
    const content = this.artifactManager.readArtifact(taskId, 'tl-code-review');
    const decision = content ? this.parseArtifactDecision(content) : null;

    if (decision === 'CHANGES_REQUESTED') {
      await this.transitionTo('developer');
    } else {
      // Find next stage after tl-code-review in activePipeline
      const pipeline = this.currentSession.activePipeline ?? DEFAULT_PIPELINE;
      const idx = pipeline.indexOf('tl-code-review');
      const nextStage = (idx !== -1 && idx < pipeline.length - 1)
        ? pipeline[idx + 1] as PipelineStage
        : 'awaiting_merge_approval';
      await this.transitionTo(nextStage);
    }
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
    const systemPrompt = buildSystemPrompt('developer', this.projectContext, undefined, artifactDir);

    // Spawn a developer agent for each subtask
    for (const subtask of this.currentSession.subtasks) {
      try {
        // Agents handle their own branching
        const taskPrompt = this.buildSubtaskPrompt(taskId, subtask, artifactContext, artifactDir);

        // Create agent — AgentPool manages one per role, so we call createAgent
        // which will return a new AgentProcess with a unique id
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
