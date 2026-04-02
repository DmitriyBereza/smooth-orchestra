import { v4 as uuid } from 'uuid';
import {
  PipelineStage,
  SessionState,
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
    eventBus.on('agent:exited', async ({ role, exitCode, taskId }) => {
      if (!this.currentSession || this.currentSession.task.id !== taskId) return;

      const stage = this.currentSession.currentStage;
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

      case 'tech-lead':
        // Tech Lead done → Developer implements
        await this.transitionTo('developer');
        break;

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

  private isTerminalStage(stage: PipelineStage): boolean {
    return stage === 'done' || stage === 'failed';
  }
}
