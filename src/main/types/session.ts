import { AgentRole } from './agent';

export type PipelineStage =
  | 'idle'
  | 'scheduled'
  | 'rate-limited'
  | 'po'
  | 'awaiting_user_review'
  | 'architect'
  | 'tech-lead'
  | 'developer'
  | 'tl-code-review'
  | 'parallel-dev'
  | 'qa'
  | 'awaiting_rejection_routing'
  | 'awaiting_merge_approval'
  | 'done'
  | 'failed'
  | 'rejected';

export interface TaskDefinition {
  id: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface SubtaskState {
  id: string;              // e.g. "subtask-1"
  index: number;           // 1-based
  parentTaskId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedAgentId: string | null;
  gitBranch: string;
  files: string[];
}

export interface SessionState {
  id: string;
  task: TaskDefinition;
  currentStage: PipelineStage;
  assignedAgents: Partial<Record<AgentRole, string>>; // role -> agent instance id
  artifacts: Record<string, string>; // artifact name -> file path
  gitBranch: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  qaDecision?: 'approved' | 'rejected' | null;
  rejectionReason?: string | null;
  subtasks: SubtaskState[];
  scheduledAt?: string | null; // ISO-8601 — if set, pipeline starts at this time
  models?: Partial<Record<AgentRole, string>>; // per-role model overrides
  retryAt?: string | null; // ISO-8601 — set when rate-limited, auto-resumes at this time
  rateLimitedStage?: PipelineStage | null; // the stage to resume after rate limit clears
  rateLimitRetries?: number; // number of consecutive rate-limit retries
  projectId?: string; // target project ID
  projectName?: string; // target project name (for display)
  projectPath?: string; // target project path (for agent cwd on restore)
}

export const PIPELINE_ORDER: PipelineStage[] = [
  'idle',
  'po',
  'awaiting_user_review',
  'architect',
  'tech-lead',
  'developer',
  'tl-code-review',
  'parallel-dev',
  'qa',
  'awaiting_merge_approval',
  'done',
];

export const STAGE_TO_ROLE: Partial<Record<PipelineStage, AgentRole>> = {
  po: 'po',
  architect: 'architect',
  'tech-lead': 'tech-lead',
  developer: 'developer',
  'tl-code-review': 'tech-lead',
  qa: 'qa',
};

export function getNextStage(current: PipelineStage): PipelineStage {
  const idx = PIPELINE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PIPELINE_ORDER.length - 1) return 'done';
  return PIPELINE_ORDER[idx + 1];
}
