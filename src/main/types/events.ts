import { AgentMessage, AgentRole, AgentStatus } from './agent';
import { PipelineStage, SessionState } from './session';
import { BacklogItem, StandbyRole, StandbyState } from './standby';
import { PoChatMessage } from './po-chat';

export interface OrchestraEventMap {
  // Agent events
  'agent:output': (message: AgentMessage) => void;
  'agent:status-changed': (data: { role: AgentRole; status: AgentStatus; taskId: string }) => void;
  'agent:spawned': (data: { role: AgentRole; pid: number; taskId: string; agentId: string }) => void;
  'agent:exited': (data: { role: AgentRole; exitCode: number | null; taskId: string; agentId: string }) => void;
  'agent:rate-limited': (data: { role: AgentRole; taskId: string; agentId: string; retryAfterMs: number; message: string }) => void;

  // Session/pipeline events
  'session:created': (session: SessionState) => void;
  'session:stage-changed': (data: { sessionId: string; from: PipelineStage; to: PipelineStage }) => void;
  'session:completed': (data: { sessionId: string; taskId: string }) => void;
  'session:failed': (data: { sessionId: string; taskId: string; error: string }) => void;
  'session:stage-continued': (data: { sessionId: string; stage: string; continuation: number }) => void;
  'session:rate-limited': (data: { sessionId: string; taskId: string; stage: string; retryAt: string; retryCount: number; message: string }) => void;
  'session:stage-resumed': (data: { sessionId: string; stage: string }) => void;

  // Subtask events (parallel dev)
  'session:subtask-started': (data: { taskId: string; subtaskId: string; agentId: string }) => void;
  'session:subtask-completed': (data: { taskId: string; subtaskId: string; agentId: string }) => void;
  'session:subtask-failed': (data: { taskId: string; subtaskId: string; agentId: string; error: string }) => void;
  'session:all-subtasks-completed': (data: { taskId: string }) => void;

  // Git events
  'git:branch-created': (data: { branch: string; taskId: string }) => void;
  'git:branch-switched': (data: { branch: string }) => void;
  'git:branch-deleted': (data: { branch: string }) => void;
  'git:merge-started': (data: { source: string; target: string; taskId: string }) => void;
  'git:merge-completed': (data: { source: string; target: string; taskId: string }) => void;
  'git:merge-conflict': (data: { source: string; target: string; taskId: string; conflicts: string[] }) => void;
  'git:sync-started': (data: { taskId: string; targetBranch: string }) => void;
  'git:sync-completed': (data: { taskId: string; branch: string }) => void;

  // Lock events
  'lock:acquired': (data: { filepath: string; holder: string; taskId: string }) => void;
  'lock:released': (data: { filepath: string; holder: string }) => void;

  // Artifact events
  'artifact:written': (data: { taskId: string; name: string; path: string }) => void;
  'artifact:read': (data: { taskId: string; name: string; role: AgentRole }) => void;

  // User-initiated commands (from frontend)
  'command:create-task': (data: { title: string; description: string; projectIds?: string[]; scheduledAt?: string; models?: Partial<Record<string, string>>; autoApproveSpec?: boolean }) => void;
  'command:approve-spec': (data: { sessionId: string; pipeline?: PipelineStage[] }) => void;
  'command:reject-spec': (data: { sessionId: string; feedback: string }) => void;
  'command:answer-questions': (data: { sessionId: string; answers: string }) => void;
  'command:abort-task': (data: { sessionId: string }) => void;
  'command:route-rejection': (data: { sessionId: string; routing: 'send_to_dev' | 'escalate_to_po' }) => void;
  'session:qa-rejection': (data: { sessionId: string; taskId: string; reason: string }) => void;
  'command:approve-merge': (data: { sessionId: string; skipMerge?: boolean }) => void;
  'command:reject-merge': (data: { sessionId: string; feedback: string }) => void;

  // PO Chat events
  'po-chat:response': (data: { projectId: string; content: string; messageId: string; done: boolean }) => void;
  'po-chat:busy': (data: { projectId: string }) => void;
  'po-chat:error': (data: { projectId: string; error: string }) => void;
  'po-chat:cleared': (data: { projectId: string }) => void;

  // Standby (idle improvement loop) events
  'standby:state-changed': (data: { state: StandbyState }) => void;
  'standby:tick-started': (data: { role: StandbyRole; startedAt: string }) => void;
  'standby:tick-finished': (data: { role: StandbyRole; exitCode: number }) => void;
  'standby:backlog-changed': (data: { backlog: BacklogItem[] }) => void;
}

export type OrchestraEvent = keyof OrchestraEventMap;
