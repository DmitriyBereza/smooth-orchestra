export type AgentRole = 'po' | 'architect' | 'tech-lead' | 'developer' | 'qa';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed';

export interface AgentMessage {
  id: string;
  role: AgentRole;
  type: 'stdout' | 'stderr' | 'status' | 'artifact';
  content: string;
  timestamp: string;
  taskId: string;
}

export interface AgentInfo {
  role: AgentRole;
  status: AgentStatus;
  taskId: string | null;
  pid: number | null;
  startedAt: string | null;
  tokensUsed: {
    input: number;
    output: number;
  };
}

export const AGENT_ROLES: AgentRole[] = ['po', 'architect', 'tech-lead', 'developer', 'qa'];

export const ROLE_DISPLAY_NAMES: Record<AgentRole, string> = {
  po: 'Product Owner',
  architect: 'Architect',
  'tech-lead': 'Tech Lead',
  developer: 'Developer',
  qa: 'QA Engineer',
};

export const ROLE_COLORS: Record<AgentRole, string> = {
  po: '#3B82F6',       // blue
  architect: '#8B5CF6', // purple
  'tech-lead': '#F97316', // orange
  developer: '#22C55E',  // green
  qa: '#EF4444',         // red
};
