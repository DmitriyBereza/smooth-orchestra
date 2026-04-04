import { AgentMessage, AgentRole, AgentStatus } from './agent';
import { PipelineStage, SessionState } from './session';

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

  // Lock events
  'lock:acquired': (data: { filepath: string; holder: string; taskId: string }) => void;
  'lock:released': (data: { filepath: string; holder: string }) => void;

  // Artifact events
  'artifact:written': (data: { taskId: string; name: string; path: string }) => void;
  'artifact:read': (data: { taskId: string; name: string; role: AgentRole }) => void;

  // User-initiated commands (from frontend)
  'command:create-task': (data: { title: string; description: string; projectIds?: string[]; scheduledAt?: string; models?: Partial<Record<string, string>> }) => void;
  'command:approve-spec': (data: { sessionId: string; pipeline?: PipelineStage[] }) => void;
  'command:reject-spec': (data: { sessionId: string; feedback: string }) => void;
  'command:answer-questions': (data: { sessionId: string; answers: string }) => void;
  'command:abort-task': (data: { sessionId: string }) => void;
  'command:route-rejection': (data: { sessionId: string; routing: 'send_to_dev' | 'escalate_to_po' }) => void;
  'session:qa-rejection': (data: { sessionId: string; taskId: string; reason: string }) => void;
  'command:approve-merge': (data: { sessionId: string }) => void;
  'command:reject-merge': (data: { sessionId: string; feedback: string }) => void;
}

export type OrchestraEvent = keyof OrchestraEventMap;
