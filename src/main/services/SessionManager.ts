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
import { buildSystemPrompt, buildTaskPrompt } from '../prompts';

/**
 * The core pipeline state machine — orchestrates the PO → Architect → Tech Lead → Dev → QA flow.
 * Manages one task at a time (MVP constraint).
 */
export class SessionManager {
  private currentSession: SessionState | null = null;
  private projectContext: string = '';

  constructor(
    private agentPool: AgentPool,
    private artifactManager: ArtifactManager,
    private gitManager: GitManager,
    private projectPath: string,
  ) {
    this.setupEventListeners();
  }

  /**
   * Set the project context string (from project.md or UI config).
   */
  setProjectContext(context: string): void {
    this.projectContext = context;
  }

  /**
   * Create a new task and start the pipeline.
   */
  async createTask(title: string, description: string): Promise<SessionState> {
    if (this.currentSession && !this.isTerminalStage(this.currentSession.currentStage)) {
      throw new Error('A task is already in progress. Complete or abort it first.');
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

    this.currentSession = {
      id: uuid(),
      task,
      currentStage: 'idle',
      assignedAgents: {},
      artifacts: {},
      gitBranch: branchName,
      startedAt: new Date().toISOString(),
      completedAt: null,
      error: null,
      subtasks: [],
    };

    eventBus.emit('session:created', this.currentSession);

    // Start the pipeline with the PO stage
    await this.transitionTo('po');

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
   * User rejects the spec — send back to PO with feedback.
   */
  async rejectSpec(feedback: string): Promise<void> {
    if (!this.currentSession || this.currentSession.currentStage !== 'awaiting_user_review') {
      throw new Error('No session awaiting user review');
    }

    // Write feedback as additional context for PO
    const taskId = this.currentSession.task.id;
    this.artifactManager.writeArtifact(taskId, 'questions', `# User Feedback\n\n${feedback}\n\nPlease revise the story based on this feedback.`);

    await this.transitionTo('po');
  }

  /**
   * Abort the current task.
   */
  async abortTask(): Promise<void> {
    if (!this.currentSession) return;

    this.agentPool.killAll();

    const session = this.currentSession;
    session.currentStage = 'failed';
    session.error = 'Aborted by user';
    session.completedAt = new Date().toISOString();

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
    const artifactContext = this.artifactManager.buildContextForRole(taskId, role);

    // Build prompts
    const systemPrompt = buildSystemPrompt(role, this.projectContext);
    const taskPrompt = buildTaskPrompt(role, taskId, title, description, artifactContext);

    // Create and start the agent
    const agent = this.agentPool.createAgent(role, taskId);
    this.currentSession.assignedAgents[role] = agent.id;

    await agent.start(systemPrompt, taskPrompt, this.projectPath);
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
          eventBus.emit('session:subtask-completed', {
            taskId,
            subtaskId: subtask.id,
            agentId: agentId || '',
          });
        } else {
          subtask.status = 'failed';
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
    eventBus.on('command:create-task', async ({ title, description }) => {
      console.log(`[SessionManager] Received create-task: "${title}"`);
      try {
        await this.createTask(title, description);
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

    eventBus.on('command:abort-task', async () => {
      try {
        await this.abortTask();
      } catch (err: any) {
        console.error('Failed to abort task:', err.message);
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
        // Developer done → QA testing
        await this.transitionTo('qa');
        break;

      case 'qa':
        // QA done → task complete!
        this.currentSession.completedAt = new Date().toISOString();
        await this.transitionTo('done');

        eventBus.emit('session:completed', {
          sessionId: this.currentSession.id,
          taskId: this.currentSession.task.id,
        });
        break;

      default:
        break;
    }
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

        await agent.start(systemPrompt, taskPrompt, this.projectPath);
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
