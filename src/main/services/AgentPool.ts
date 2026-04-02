import { AgentRole, AgentInfo } from '../types';
import { AgentProcess } from './AgentProcess';
import { eventBus } from './EventBus';

/**
 * Manages the lifecycle of all active AgentProcess instances.
 * Enforces that only one agent per role runs at a time (MVP constraint).
 */
export class AgentPool {
  private agents = new Map<AgentRole, AgentProcess>();

  constructor() {
    // Auto-cleanup on agent exit
    eventBus.on('agent:exited', ({ role }) => {
      // Keep the reference for output retrieval, but mark it done
      // It will be overwritten when a new agent is spawned for the role
    });
  }

  /**
   * Create a new agent for the given role and task.
   * Kills any existing agent for that role.
   */
  createAgent(role: AgentRole, taskId: string): AgentProcess {
    // Kill existing agent for this role if any
    const existing = this.agents.get(role);
    if (existing && existing.status === 'running') {
      existing.kill();
    }

    const agent = new AgentProcess(role, taskId);
    this.agents.set(role, agent);
    return agent;
  }

  /**
   * Get the current agent for a role.
   */
  getAgent(role: AgentRole): AgentProcess | null {
    return this.agents.get(role) || null;
  }

  /**
   * Kill a specific agent by role.
   */
  killAgent(role: AgentRole): void {
    const agent = this.agents.get(role);
    if (agent && agent.status === 'running') {
      agent.kill();
    }
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
}
