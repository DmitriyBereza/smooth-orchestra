import { create } from 'zustand';

// Re-define types for the renderer (no Node.js imports)
export type PipelineType = 'development' | 'marketing' | 'design';

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

export type PipelineStage =
  // System stages (shared)
  | 'idle' | 'scheduled' | 'rate-limited' | 'po' | 'awaiting_user_review'
  | 'awaiting_rejection_routing' | 'awaiting_merge_approval'
  | 'done' | 'failed' | 'rejected'
  // Development pipeline stages
  | 'tech-researcher' | 'architect' | 'tech-lead' | 'developer'
  | 'tl-code-review' | 'parallel-dev' | 'qa'
  // Marketing pipeline stages
  | 'marketing-researcher' | 'marketing-strategist' | 'copywriter'
  | 'creative-director' | 'marketing-qa'
  // Design pipeline stages
  | 'design-researcher' | 'ux-designer' | 'ui-designer'
  | 'design-executor' | 'design-reviewer' | 'design-qa';

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
  tokensUsed: { input: number; output: number };
}

export interface SubtaskState {
  id: string;
  index: number;
  parentTaskId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgentId: string | null;
  gitBranch: string;
  files: string[];
}

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  pipelineType?: PipelineType;
}

export interface SessionState {
  id: string;
  task: TaskDefinition;
  currentStage: PipelineStage;
  assignedAgents: Partial<Record<AgentRole, string>>;
  artifacts: Record<string, string>;
  gitBranch: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  qaDecision?: 'approved' | 'rejected' | null;
  rejectionReason?: string | null;
  subtasks: SubtaskState[];
  scheduledAt?: string | null;
  retryAt?: string | null;
  rateLimitedStage?: PipelineStage | null;
  models?: Partial<Record<AgentRole, string>>;
  /** IDs of all selected projects for this task (primary project is first). */
  projectIds?: string[];
  projectId?: string;
  projectName?: string;
  projectPath?: string;
  proposedPipeline?: PipelineStage[];
  activePipeline?: PipelineStage[];
  jiraIssueKey?: string | null;
  pipelineType?: PipelineType;
  autoApproveSpec?: boolean;
  autoSkipMerge?: boolean;
  mergeSkipped?: boolean;
}

export const ROLE_DISPLAY_NAMES: Record<AgentRole, string> = {
  po: 'Product Owner',
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
  po: '#3B82F6',
  'tech-researcher': '#06B6D4',
  architect: '#8B5CF6',
  'tech-lead': '#F97316',
  developer: '#22C55E',
  qa: '#EF4444',
  'marketing-researcher': '#F59E0B',
  'marketing-strategist': '#D97706',
  copywriter: '#EC4899',
  'creative-director': '#BE185D',
  'marketing-qa': '#DC2626',
  'design-researcher': '#0EA5E9',
  'ux-designer': '#6366F1',
  'ui-designer': '#8B5CF6',
  'design-executor': '#A855F7',
  'design-reviewer': '#7C3AED',
  'design-qa': '#4F46E5',
};

export const STAGE_DISPLAY: Record<PipelineStage, string> = {
  // System
  idle: 'Idle',
  scheduled: 'Scheduled',
  'rate-limited': 'Rate Limited',
  po: 'Product Owner',
  awaiting_user_review: 'Awaiting Review',
  awaiting_rejection_routing: 'QA Rejected',
  awaiting_merge_approval: 'Merge Approval',
  done: 'Done',
  failed: 'Failed',
  rejected: 'Rejected',
  // Development
  'tech-researcher': 'Tech Research',
  architect: 'Architect',
  'tech-lead': 'Tech Lead Review',
  developer: 'Development',
  'tl-code-review': 'Code Review',
  'parallel-dev': 'Parallel Dev',
  qa: 'QA Testing',
  // Marketing
  'marketing-researcher': 'Market Research',
  'marketing-strategist': 'Strategy',
  copywriter: 'Copywriting',
  'creative-director': 'Creative Review',
  'marketing-qa': 'Marketing QA',
  // Design
  'design-researcher': 'Design Research',
  'ux-designer': 'UX Design',
  'ui-designer': 'UI Design',
  'design-executor': 'Design Execution',
  'design-reviewer': 'Design Review',
  'design-qa': 'Design QA',
};

// Initial empty agent outputs — dynamically extended for new roles
const EMPTY_AGENT_OUTPUTS: Record<AgentRole, AgentMessage[]> = {
  po: [],
  'tech-researcher': [],
  architect: [],
  'tech-lead': [],
  developer: [],
  qa: [],
  'marketing-researcher': [],
  'marketing-strategist': [],
  copywriter: [],
  'creative-director': [],
  'marketing-qa': [],
  'design-researcher': [],
  'ux-designer': [],
  'ui-designer': [],
  'design-executor': [],
  'design-reviewer': [],
  'design-qa': [],
};

interface OrchestraStore {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Session state
  session: SessionState | null;
  setSession: (session: SessionState | null) => void;
  updateStage: (stage: PipelineStage) => void;

  // Agent outputs (streaming)
  agentOutputs: Record<AgentRole, AgentMessage[]>;
  addAgentOutput: (message: AgentMessage) => void;
  clearAgentOutputs: () => void;

  // Agent info
  agents: AgentInfo[];
  setAgents: (agents: AgentInfo[]) => void;
  updateAgentStatus: (role: AgentRole, status: AgentStatus) => void;

  // Subtasks (parallel dev)
  subtasks: SubtaskState[];
  setSubtasks: (subtasks: SubtaskState[]) => void;
  updateSubtask: (subtaskId: string, update: Partial<SubtaskState>) => void;

  // Event log
  events: Array<{ timestamp: string; message: string; type: string }>;
  addEvent: (message: string, type: string) => void;

  // Session history
  sessionHistory: SessionState[];
  setSessionHistory: (history: SessionState[]) => void;

  // Hydrate agent outputs from snapshot (bulk)
  hydrateAgentOutputs: (outputs: Record<string, string[]>) => void;

  // Active agent tab (shared between PipelineView and AgentPanel)
  activeAgentTab: AgentRole;
  setActiveAgentTab: (role: AgentRole) => void;

  // Event filters
  eventFilters: {
    category: string | null;
    role: string | null;
    search: string;
  };
  setEventFilter: (filters: Partial<{ category: string | null; role: string | null; search: string }>) => void;
}

export const useStore = create<OrchestraStore>((set) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Session
  session: null,
  setSession: (session) => set({ session }),
  updateStage: (stage) =>
    set((state) => ({
      session: state.session ? { ...state.session, currentStage: stage } : null,
    })),

  // Agent outputs
  agentOutputs: { ...EMPTY_AGENT_OUTPUTS },
  addAgentOutput: (message) =>
    set((state) => ({
      agentOutputs: {
        ...state.agentOutputs,
        [message.role]: [...(state.agentOutputs[message.role] || []), message],
      },
    })),
  clearAgentOutputs: () =>
    set({
      agentOutputs: { ...EMPTY_AGENT_OUTPUTS },
    }),

  // Agents
  agents: [],
  setAgents: (agents) => set({ agents }),
  updateAgentStatus: (role, status) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.role === role ? { ...a, status } : a
      ),
    })),

  // Subtasks
  subtasks: [],
  setSubtasks: (subtasks) => set({ subtasks }),
  updateSubtask: (subtaskId, update) =>
    set((state) => ({
      subtasks: state.subtasks.map((s) =>
        s.id === subtaskId ? { ...s, ...update } : s,
      ),
    })),

  // Events
  events: [],
  addEvent: (message, type) =>
    set((state) => ({
      events: [
        { timestamp: new Date().toISOString(), message, type },
        ...state.events,
      ].slice(0, 200), // Keep last 200 events
    })),

  // Session history
  sessionHistory: [],
  setSessionHistory: (history) => set({ sessionHistory: history }),

  // Hydrate agent outputs from snapshot
  hydrateAgentOutputs: (outputs) =>
    set(() => {
      const hydrated = { ...EMPTY_AGENT_OUTPUTS };
      for (const [role, lines] of Object.entries(outputs)) {
        if (role in hydrated) {
          (hydrated as any)[role] = lines.map((line: string, i: number) => ({
            id: `snapshot-${role}-${i}`,
            role,
            type: 'stdout' as const,
            content: line,
            timestamp: new Date().toISOString(),
            taskId: '',
          }));
        }
      }
      return { agentOutputs: hydrated };
    }),

  // Active agent tab
  activeAgentTab: 'po' as AgentRole,
  setActiveAgentTab: (role) => set({ activeAgentTab: role }),

  // Event filters
  eventFilters: { category: null, role: null, search: '' },
  setEventFilter: (filters) =>
    set((state) => ({
      eventFilters: { ...state.eventFilters, ...filters },
    })),
}));
