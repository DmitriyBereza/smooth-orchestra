import { create } from 'zustand';

// Re-define types for the renderer (no Node.js imports)
export type AgentRole = 'po' | 'architect' | 'tech-lead' | 'developer' | 'qa';
export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'killed';
export type PipelineStage =
  | 'idle' | 'scheduled' | 'po' | 'awaiting_user_review' | 'architect'
  | 'tech-lead' | 'developer' | 'tl-code-review' | 'parallel-dev' | 'qa'
  | 'awaiting_rejection_routing' | 'awaiting_merge_approval'
  | 'done' | 'failed' | 'rejected';

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
  models?: Partial<Record<AgentRole, string>>;
}

export const ROLE_DISPLAY_NAMES: Record<AgentRole, string> = {
  po: 'Product Owner',
  architect: 'Architect',
  'tech-lead': 'Tech Lead',
  developer: 'Developer',
  qa: 'QA Engineer',
};

export const ROLE_COLORS: Record<AgentRole, string> = {
  po: '#3B82F6',
  architect: '#8B5CF6',
  'tech-lead': '#F97316',
  developer: '#22C55E',
  qa: '#EF4444',
};

export const STAGE_DISPLAY: Record<PipelineStage, string> = {
  idle: 'Idle',
  scheduled: 'Scheduled',
  po: 'Product Owner',
  awaiting_user_review: 'Awaiting Review',
  architect: 'Architect',
  'tech-lead': 'Tech Lead Review',
  developer: 'Development',
  'tl-code-review': 'Code Review',
  'parallel-dev': 'Parallel Dev',
  qa: 'QA Testing',
  awaiting_rejection_routing: 'QA Rejected',
  awaiting_merge_approval: 'Merge Approval',
  done: 'Done',
  failed: 'Failed',
  rejected: 'Rejected',
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
  agentOutputs: {
    po: [],
    architect: [],
    'tech-lead': [],
    developer: [],
    qa: [],
  },
  addAgentOutput: (message) =>
    set((state) => ({
      agentOutputs: {
        ...state.agentOutputs,
        [message.role]: [...(state.agentOutputs[message.role] || []), message],
      },
    })),
  clearAgentOutputs: () =>
    set({
      agentOutputs: { po: [], architect: [], 'tech-lead': [], developer: [], qa: [] },
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

  // Event filters
  eventFilters: { category: null, role: null, search: '' },
  setEventFilter: (filters) =>
    set((state) => ({
      eventFilters: { ...state.eventFilters, ...filters },
    })),
}));
