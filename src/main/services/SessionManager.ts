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

  constructor(
    private agentPool: AgentPool,
    private artifactManager: ArtifactManager,
    private gitManager: GitManager,
    private projectPath: string,
    private projectStore?: ProjectStore,
    orchestraDir?: string,
  ) {
    this.sessionFilePath = path.join(orchestraDir ?? path.join(projectPath, '.orchestra'), 'session.json');
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
      console.log(`[SessionManager] Restored session ${session.task.id} at stage: ${session.currentStage}`);

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
   * If projectId is provided, the task runs against that project's path.
   * If scheduledAt is provided (ISO-8601), the pipeline starts at that time.
   */
  async createTask(title: string, description: string, projectId?: string, scheduledAt?: string, models?: Partial<Record<AgentRole, string>>): Promise<SessionState> {
    if (this.currentSession && !this.isTerminalStage(this.currentSession.currentStage)) {
      throw new Error('A task is already in progress. Complete or abort it first.');
    }

    // Resolve effective project path and update context for agents
    if (projectId && this.projectStore) {
      const project = this.projectStore.findById(projectId);
      if (!project) {
        throw new Error(`Project not found: ${projectId}`);
      }
      this.projectPath = project.path;
      this.gitManager = new GitManager(project.path);

      // Build project context from metadata + optional project.md in the target repo
      const contextParts = [
        `**Project**: ${project.name}`,
        `**Code Location**: ${project.path}`,
      ];
      if (project.labels.length > 0) {
        contextParts.push(`**Labels**: ${project.labels.join(', ')}`);
      }

      // Load project.md from the target project if it exists
      const targetProjectMd = path.join(project.path, '.orchestra', 'project.md');
      if (fs.existsSync(targetProjectMd)) {
        const mdContent = fs.readFileSync(targetProjectMd, 'utf-8');
        contextParts.push('', mdContent);
      }

      this.projectContext = contextParts.join('\n');
    }

    const taskId = `TASK-${uuid().slice(0, 8).toUpperCase()}`;
    const branchName = `orchestra/${taskId}`;

    const task: TaskDefinition = {
      id: taskId,
      title,
      description,
      createdAt: new Date().toISOString(),
    };

    // Create task directory
    this.artifactManager.getTaskDir(taskId);

    // Create git branch
    try {
      await this.gitManager.createBranch(branchName, taskId);
    } catch (err) {
      // If branch creation fails (e.g., no initial commit), continue without branching
      console.warn(`Git branch creation failed: ${err}. Continuing without branch.`);
    }

    const isScheduled = scheduledAt && new Date(scheduledAt).getTime() > Date.now();

    this.currentSession = {
      id: uuid(),
      task,
      currentStage: isScheduled ? 'scheduled' : 'idle',
      assignedAgents: {},
      artifacts: {},
      gitBranch: branchName,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      subtasks: [],
      scheduledAt: isScheduled ? scheduledAt : null,
      models: models ?? {},
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
   * User approves the spec — advance from awaiting_user_review to architect.
   */
  async approveSpec(): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }
    await this.transitionTo('architect');
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

    if (this.currentSession.gitBranch) {
      try {
        const defaultBranch = await this.gitManager.getDefaultBranch();
        await this.gitManager.switchBranch(defaultBranch);
        // GitManager may not have mergeBranch yet (Unit 3).
        // For now, just transition to done. The merge can be a manual step.
      } catch (err) {
        console.warn(`Merge failed: ${err}. Task marked as done anyway.`);
      }
    }

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

    // Build context from previous stage artifacts
    const artifactContext = this.artifactManager.buildContextForRole(taskId, role, stage);

    // Build prompts
    const systemPrompt = buildSystemPrompt(role, this.projectContext, stage);
    const taskPrompt = buildTaskPrompt(role, taskId, title, description, artifactContext, stage);

    // Create and start the agent
    const agent = this.agentPool.createAgent(role, taskId);
    this.currentSession.assignedAgents[role] = agent.id;

    const modelForRole = this.currentSession.models?.[role] || undefined;
    await agent.start(systemPrompt, taskPrompt, this.projectPath, modelForRole);
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

      // Agent completed successfully — advance pipeline
      await this.advancePipeline(stage);
    });

    // Handle user commands from the frontend
    eventBus.on('command:create-task', async ({ title, description, projectId, scheduledAt, models }: { title: string; description: string; projectId?: string; scheduledAt?: string; models?: Partial<Record<AgentRole, string>> }) => {
      console.log(`[SessionManager] Received create-task: "${title}" (project: ${projectId ?? 'default'}, scheduled: ${scheduledAt ?? 'now'}, models: ${JSON.stringify(models ?? {})})`);
      try {
        await this.createTask(title, description, projectId, scheduledAt, models);
      } catch (err: any) {
        console.error('[SessionManager] Failed to create task:', err.message, err.stack);
      }
    });

    eventBus.on('command:approve-spec', async () => {
      try {
        await this.approveSpec();
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
   */
  private async advancePipeline(completedStage: PipelineStage): Promise<void> {
    if (!this.currentSession) return;

    switch (completedStage) {
      case 'po':
        // PO done → wait for user review
        await this.transitionTo('awaiting_user_review');
        break;

      case 'architect':
        // Architect done → Tech Lead review
        await this.transitionTo('tech-lead');
        break;

      case 'tech-lead': {
        // Tech Lead done → check if multiple dev tasks → parallel or single dev
        const devTasksContent = this.artifactManager.readArtifact(
          this.currentSession!.task.id, 'dev-tasks');
        const parsed = devTasksContent ? this.parseDevTasks(devTasksContent) : [];

        if (parsed.length > 1) {
          await this.transitionTo('parallel-dev');
        } else {
          await this.transitionTo('developer');
        }
        break;
      }

      case 'developer':
        // Developer done → Tech Lead code review
        await this.transitionTo('tl-code-review');
        break;

      case 'tl-code-review':
        // TL code review done → check decision
        await this.handleCodeReviewDecision();
        break;

      case 'qa': {
        const taskId = this.currentSession.task.id;
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
          // QA passed → await merge approval (human gate)
          await this.transitionTo('awaiting_merge_approval');
        }
        break;
      }

      default:
        break;
    }
  }

  private parseArtifactDecision(content: string): string | null {
    const match = content.match(/##\s*(?:Decision|Verdict):\s*(\w+)/i);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Handle the TL code review decision — approve to QA or loop back to developer.
   */
  private async handleCodeReviewDecision(): Promise<void> {
    if (!this.currentSession) return;

    const taskId = this.currentSession.task.id;
    const content = this.artifactManager.readArtifact(taskId, 'tl-code-review');
    const decision = content ? this.parseArtifactDecision(content) : null;

    if (decision === 'CHANGES_REQUESTED') {
      await this.transitionTo('developer');
    } else {
      await this.transitionTo('qa');
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
    const artifactContext = this.artifactManager.buildContextForRole(taskId, 'developer');
    const systemPrompt = buildSystemPrompt('developer', this.projectContext);

    // Spawn a developer agent for each subtask
    for (const subtask of this.currentSession.subtasks) {
      try {
        // Create subtask git branch from the task branch
        try {
          await this.gitManager.createBranch(subtask.gitBranch, taskId);
        } catch (err) {
          console.warn(`Failed to create subtask branch: ${err}`);
        }

        const taskPrompt = this.buildSubtaskPrompt(taskId, subtask, artifactContext);

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
  ): string {
    return [
      `# Task Assignment — Subtask ${subtask.index}`,
      ``,
      `**Task ID**: ${taskId}`,
      `**Subtask**: ${subtask.title}`,
      `**Your assigned files**: ${subtask.files.join(', ') || 'See dev-tasks.md'}`,
      `**Your git branch**: ${subtask.gitBranch}`,
      ``,
      `IMPORTANT: Only modify files assigned to you. Other files are locked by other developers.`,
      `Write your dev-notes to: .orchestra/tasks/${taskId}/dev-notes-${subtask.index}.md`,
      `Write your QA spec to: .orchestra/tasks/${taskId}/qa-spec-${subtask.index}.md`,
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
