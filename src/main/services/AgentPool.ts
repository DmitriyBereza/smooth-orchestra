import { AgentRole, AgentInfo } from '../types';
import { AgentProcess } from './AgentProcess';
import { eventBus } from './EventBus';

/**
 * Manages the lifecycle of all active AgentProcess instances.
 * Supports multiple concurrent agents per role (keyed by unique agent ID).
 */
export class AgentPool {
  /** All agents keyed by their unique ID. */
  private agents = new Map<string, AgentProcess>();

  /** Quick lookup: role -> set of agent IDs currently held for that role. */
  private roleIndex = new Map<AgentRole, Set<string>>();

  constructor() {
    // Remove terminated agents so the maps don't grow unboundedly
    eventBus.on('agent:exited', ({ agentId }) => {
      this.removeAgent(agentId);
    });
  }

  /**
   * Create a new agent for the given role and task.
   *
   * For non-developer roles (or when no subtaskId is provided), existing
   * agents for that role are killed first, preserving the MVP one-at-a-time
   * behaviour. Developer agents with a subtaskId are allowed to run
   * concurrently.
   */
  createAgent(role: AgentRole, taskId: string, subtaskId?: string): AgentProcess {
    const allowConcurrent = role === 'developer' && subtaskId != null;

    if (!allowConcurrent) {
      // Kill all existing agents for this role (MVP: one per role)
      this.killAgentsByRole(role);
    }

    const agent = new AgentProcess(role, taskId, subtaskId);
    this.agents.set(agent.id, agent);
    if (!this.roleIndex.has(role)) {
      this.roleIndex.set(role, new Set());
    }
    this.roleIndex.get(role)!.add(agent.id);
    return agent;
  }

  /**
   * Get an agent by its unique ID.
   */
  getAgentById(id: string): AgentProcess | null {
    return this.agents.get(id) || null;
  }

  /**
   * Get all agents currently registered for a role.
   */
  getAgentsByRole(role: AgentRole): AgentProcess[] {
    const ids = this.roleIndex.get(role);
    if (!ids) return [];
    const result: AgentProcess[] = [];
    for (const id of ids) {
      const agent = this.agents.get(id);
      if (agent) result.push(agent);
    }
    return result;
  }

  /**
   * Get the current agent for a role (returns the first one found).
   * @deprecated Use getAgentsByRole() for multi-instance support.
   */
  getAgent(role: AgentRole): AgentProcess | null {
    const agents = this.getAgentsByRole(role);
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * Kill a specific agent by role.
   * @deprecated Use killByAgentId() for precise control.
   */
  killAgent(role: AgentRole): void {
    const agent = this.getAgent(role);
    if (agent && agent.status === 'running') {
      agent.kill();
    }
  }

  /**
   * Kill a specific agent by its unique ID.
   */
  killByAgentId(id: string): void {
    const agent = this.agents.get(id);
    if (agent && agent.status === 'running') {
      agent.kill();
    }
    this.removeAgent(id);
  }

  /**
   * Kill all running agents.
   */
  killAll(): void {
    for (const agent of this.agents.values()) {
      if (agent.status === 'running') {
        agent.kill();
      }
    }
  }

  /**
   * Get info about all agents (for UI display).
   */
  getAllAgentInfo(): AgentInfo[] {
    const infos: AgentInfo[] = [];
    for (const agent of this.agents.values()) {
      infos.push({
        role: agent.role,
        status: agent.status,
        taskId: agent.taskId,
        pid: agent.pid,
        startedAt: null, // Could be tracked in AgentProcess if needed
        tokensUsed: agent.tokensUsed,
        agentId: agent.id,
        subtaskId: agent.subtaskId,
      });
    }
    return infos;
  }

  /**
   * Check if any agent is currently running.
   */
  hasRunningAgents(): boolean {
    for (const agent of this.agents.values()) {
      if (agent.status === 'running') return true;
    }
    return false;
  }

  /**
   * Kill all agents for a given role and remove them from tracking.
   */
  private killAgentsByRole(role: AgentRole): void {
    const ids = this.roleIndex.get(role);
    if (!ids) return;
    for (const id of [...ids]) {
      const agent = this.agents.get(id);
      if (agent && agent.status === 'running') {
        agent.kill();
      }
      this.removeAgent(id);
    }
  }

  /**
   * Remove an agent from both the primary map and the role index.
   */
  private removeAgent(id: string): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    this.agents.delete(id);
    const roleSet = this.roleIndex.get(agent.role);
    if (roleSet) {
      roleSet.delete(id);
      if (roleSet.size === 0) {
        this.roleIndex.delete(agent.role);
      }
    }
  }
}
