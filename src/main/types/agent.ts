export type AgentRole =
  // Development pipeline roles
  | 'po'
  | 'tech-researcher'
  | 'architect'
  | 'tech-lead'
  | 'developer'
  | 'qa'
  // Marketing pipeline roles
  | 'marketing-researcher'
  | 'marketing-strategist'
  | 'copywriter'
  | 'creative-director'
  | 'marketing-qa'
  // Design pipeline roles
  | 'design-researcher'
  | 'ux-designer'
  | 'ui-designer'
  | 'design-executor'
  | 'design-reviewer'
  | 'design-qa';

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
  /** Unique identifier for this agent instance. */
  agentId?: string;
  /** Subtask identifier when running as one of multiple concurrent agents. */
  subtaskId?: string;
}

export const AGENT_ROLES: AgentRole[] = [
  'po',
  'tech-researcher',
  'architect',
  'tech-lead',
  'developer',
  'qa',
  'marketing-researcher',
  'marketing-strategist',
  'copywriter',
  'creative-director',
  'marketing-qa',
  'design-researcher',
  'ux-designer',
  'ui-designer',
  'design-executor',
  'design-reviewer',
  'design-qa',
];

export const ROLE_DISPLAY_NAMES: Record<AgentRole, string> = {
  po: 'Product Owner',
  'tech-researcher': 'Tech Researcher',
  architect: 'Architect',
  'tech-lead': 'Tech Lead',
  developer: 'Developer',
  qa: 'QA Engineer',
  'marketing-researcher': 'Marketing Researcher',
  'marketing-strategist': 'Marketing Strategist',
  copywriter: 'Copywriter',
  'creative-director': 'Creative Director',
  'marketing-qa': 'Marketing QA',
  'design-researcher': 'Design Researcher',
  'ux-designer': 'UX Designer',
  'ui-designer': 'UI Designer',
  'design-executor': 'Design Executor',
  'design-reviewer': 'Design Reviewer',
  'design-qa': 'Design QA',
};

export const ROLE_COLORS: Record<AgentRole, string> = {
  po: '#3B82F6',           // blue
  'tech-researcher': '#06B6D4', // cyan
  architect: '#8B5CF6',    // purple
  'tech-lead': '#F97316',  // orange
  developer: '#22C55E',    // green
  qa: '#EF4444',           // red
  // Marketing pipeline — warm palette
  'marketing-researcher': '#F59E0B', // amber
  'marketing-strategist': '#D97706', // dark amber
  copywriter: '#EC4899',   // pink
  'creative-director': '#BE185D', // dark pink
  'marketing-qa': '#DC2626', // red
  // Design pipeline — cool palette
  'design-researcher': '#0EA5E9', // sky blue
  'ux-designer': '#6366F1', // indigo
  'ui-designer': '#8B5CF6', // purple
  'design-executor': '#A855F7', // violet
  'design-reviewer': '#7C3AED', // dark violet
  'design-qa': '#4F46E5',  // dark indigo
};
