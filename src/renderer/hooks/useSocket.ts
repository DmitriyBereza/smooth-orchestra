import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';
import { useStandbyStore, BacklogItem, StandbyState } from '../store/standbyStore';

// In dev, Vite proxy forwards /socket.io to the backend.
// Use the current page origin so it works through tunnels too.
const SOCKET_URL = window.location.origin;

// Single shared socket instance
let socket: Socket | null = null;
let currentToken: string | null = null;

function getSocket(token?: string | null): Socket {
  // Reconnect if token changed (login/logout)
  if (socket && token !== currentToken) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    currentToken = token ?? null;
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      auth: token ? { token } : undefined,
    });
  }
  return socket;
}

export function useSocket() {
  const {
    setConnected,
    setSession,
    updateStage,
    addAgentOutput,
    setAgents,
    updateAgentStatus,
    addEvent,
    setSubtasks,
    updateSubtask,
    setSessionHistory,
    hydrateAgentOutputs,
  } = useStore();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (!token) return; // Don't connect without auth

    const s = getSocket(token);

    s.on('connect', () => {
      setConnected(true);
      addEvent('Connected to Smooth Orchestra server', 'system');
    });

    s.on('disconnect', () => {
      setConnected(false);
      addEvent('Disconnected from Smooth Orchestra server', 'system');
    });

    s.on('connect_error', (err: Error) => {
      if (err.message === '401') {
        // Token expired or invalid — force re-login
        logout();
      }
    });

    // Session events
    s.on('session:snapshot', (data: { session: any; agents: any[]; agentOutputs?: Record<string, string[]>; history?: any[] }) => {
      setSession(data.session);
      setAgents(data.agents);
      if (data.session?.subtasks) {
        setSubtasks(data.session.subtasks);
      }
      if (data.agentOutputs) {
        hydrateAgentOutputs(data.agentOutputs);
      }
      if (data.history) {
        setSessionHistory(data.history);
      }
    });

    s.on('session:created', (session: any) => {
      setSession(session);
      setSubtasks(session.subtasks || []);
      addEvent(`Task created: ${session.task.title}`, 'session');
    });

    s.on('session:stage-changed', (data: { from: string; to: string }) => {
      updateStage(data.to as any);
      addEvent(`Pipeline: ${data.from} -> ${data.to}`, 'session');
    });

    s.on('session:completed', (data: { taskId: string }) => {
      addEvent(`Task completed: ${data.taskId}`, 'session');
    });

    s.on('session:failed', (data: { taskId: string; error: string }) => {
      addEvent(`Task failed: ${data.error}`, 'error');
    });

    // Agent events
    s.on('agent:output', (message: any) => {
      addAgentOutput(message);
    });

    s.on('agent:spawned', (data: { role: string; pid: number }) => {
      addEvent(`Agent spawned: ${data.role} (PID: ${data.pid})`, 'agent');
    });

    s.on('agent:status-changed', (data: { role: string; status: string }) => {
      updateAgentStatus(data.role as any, data.status as any);
      addEvent(`Agent ${data.role}: ${data.status}`, 'agent');
    });

    s.on('agent:exited', (data: { role: string; exitCode: number }) => {
      addEvent(`Agent ${data.role} exited (code: ${data.exitCode})`, 'agent');
    });

    // Artifact events
    s.on('artifact:written', (data: { taskId: string; name: string }) => {
      addEvent(`Artifact written: ${data.name} (${data.taskId})`, 'artifact');
    });

    // Subtask events (parallel dev)
    s.on('session:subtask-started', (data: { taskId: string; subtaskId: string; agentId: string }) => {
      updateSubtask(data.subtaskId, { status: 'in_progress', assignedAgentId: data.agentId });
      addEvent(`Subtask started: ${data.subtaskId}`, 'agent');
    });

    s.on('session:subtask-completed', (data: { taskId: string; subtaskId: string }) => {
      updateSubtask(data.subtaskId, { status: 'completed' });
      addEvent(`Subtask completed: ${data.subtaskId}`, 'agent');
    });

    s.on('session:subtask-failed', (data: { taskId: string; subtaskId: string; error: string }) => {
      updateSubtask(data.subtaskId, { status: 'failed' });
      addEvent(`Subtask failed: ${data.subtaskId} — ${data.error}`, 'error');
    });

    s.on('session:all-subtasks-completed', (data: { taskId: string }) => {
      addEvent(`All subtasks completed for ${data.taskId}`, 'session');
    });

    // Git events
    s.on('git:branch-created', (data: { branch: string }) => {
      addEvent(`Branch created: ${data.branch}`, 'git');
    });

    s.on('session:qa-rejection', (data: { sessionId: string; taskId: string; reason: string }) => {
      addEvent(`QA rejected task: ${data.reason}`, 'error');
    });

    s.on('session:stage-continued', (data: { sessionId: string; stage: string; continuation: number }) => {
      addEvent(`Agent hit max-turns — resuming ${data.stage} (continuation ${data.continuation}/3)`, 'agent');
    });

    // Standby events
    s.on('standby:snapshot', (data: { state: StandbyState; backlog: BacklogItem[] }) => {
      useStandbyStore.getState().setSnapshot(data);
    });
    s.on('standby:state-changed', (data: { state: StandbyState }) => {
      useStandbyStore.getState().setState(data.state);
    });
    s.on('standby:backlog-changed', (data: { backlog: BacklogItem[] }) => {
      useStandbyStore.getState().setBacklog(data.backlog);
    });
    s.on('standby:tick-started', (data: { role: string }) => {
      useStandbyStore.getState().setTicking(true);
      addEvent(`Standby tick started: ${data.role}`, 'system');
    });
    s.on('standby:tick-finished', (data: { role: string; exitCode: number }) => {
      useStandbyStore.getState().setTicking(false);
      addEvent(`Standby tick finished: ${data.role} (exit ${data.exitCode})`, 'system');
    });

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socket = null;
      currentToken = null;
    };
  }, [token]);
}

/**
 * Returns stable command functions that emit on the shared socket.
 */
export function useSocketCommands() {
  const createTask = useCallback((title: string, description: string, projectIds?: string[], scheduledAt?: string, models?: Record<string, string>, jiraIssueKey?: string, createJiraIssue?: boolean, pipelineType?: string) => {
    if (!socket) return;
    console.log('[Smooth Orchestra] Emitting command:create-task', { title, projectIds, scheduledAt, jiraIssueKey, createJiraIssue, pipelineType });
    socket.emit('command:create-task', { title, description, projectIds, scheduledAt, models, jiraIssueKey, createJiraIssue, pipelineType: pipelineType ?? 'development' });
  }, []);

  const approveSpec = useCallback((sessionId: string, pipeline?: string[]) => {
    socket?.emit('command:approve-spec', { sessionId, pipeline });
  }, []);

  const rejectSpec = useCallback((sessionId: string, feedback: string) => {
    socket?.emit('command:reject-spec', { sessionId, feedback });
  }, []);

  const answerQuestions = useCallback((sessionId: string, answers: string) => {
    socket?.emit('command:answer-questions', { sessionId, answers });
  }, []);

  const abortTask = useCallback((sessionId: string) => {
    socket?.emit('command:abort-task', { sessionId });
  }, []);

  const routeRejection = useCallback((sessionId: string, routing: 'send_to_dev' | 'escalate_to_po') => {
    socket?.emit('command:route-rejection', { sessionId, routing });
  }, []);

  const approveMerge = useCallback((sessionId: string) => {
    socket?.emit('command:approve-merge', { sessionId });
  }, []);

  const rejectMerge = useCallback((sessionId: string, feedback: string) => {
    socket?.emit('command:reject-merge', { sessionId, feedback });
  }, []);

  return { createTask, approveSpec, rejectSpec, answerQuestions, abortTask, routeRejection, approveMerge, rejectMerge };

}
