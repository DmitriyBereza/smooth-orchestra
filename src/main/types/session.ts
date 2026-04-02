import { AgentRole } from './agent';

export type PipelineStage =
  | 'idle'
  | 'po'
  | 'awaiting_user_review'
  | 'architect'
  | 'tech-lead'
  | 'developer'
  | 'qa'
  | 'awaiting_rejection_routing'
  | 'done'
  | 'failed'
  | 'rejected';

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
  assignedAgents: Partial<Record<AgentRole, string>>; // role -> agent instance id
  artifacts: Record<string, string>; // artifact name -> file path
  gitBranch: string | null;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  qaDecision?: 'approved' | 'rejected' | null;
  rejectionReason?: string | null;
}

export const PIPELINE_ORDER: PipelineStage[] = [
  'idle',
  'po',
  'awaiting_user_review',
  'architect',
  'tech-lead',
  'developer',
  'qa',
  'done',
];

export const STAGE_TO_ROLE: Partial<Record<PipelineStage, AgentRole>> = {
  po: 'po',
  architect: 'architect',
  'tech-lead': 'tech-lead',
  developer: 'developer',
  qa: 'qa',
};

export function getNextStage(current: PipelineStage): PipelineStage {
  const idx = PIPELINE_ORDER.indexOf(current);
  if (idx === -1 || idx >= PIPELINE_ORDER.length - 1) return 'done';
  return PIPELINE_ORDER[idx + 1];
}
