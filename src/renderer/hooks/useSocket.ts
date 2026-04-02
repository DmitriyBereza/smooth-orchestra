import { useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/sessionStore';

const SOCKET_URL = 'http://localhost:3333';

// Single shared socket instance
let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
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
  } = useStore();

  useEffect(() => {
    const s = getSocket();

    s.on('connect', () => {
      setConnected(true);
      addEvent('Connected to Orchestra server', 'system');
    });

    s.on('disconnect', () => {
      setConnected(false);
      addEvent('Disconnected from Orchestra server', 'system');
    });

    // Session events
    s.on('session:snapshot', (data: { session: any; agents: any[] }) => {
      setSession(data.session);
      setAgents(data.agents);
      if (data.session?.subtasks) {
        setSubtasks(data.session.subtasks);
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

    return () => {
      s.removeAllListeners();
      s.disconnect();
      socket = null;
    };
  }, []);
}

/**
 * Returns stable command functions that emit on the shared socket.
 */
export function useSocketCommands() {
  const createTask = useCallback((title: string, description: string) => {
    const s = getSocket();
    console.log('[Orchestra] Emitting command:create-task', { title, description });
    s.emit('command:create-task', { title, description });
  }, []);

  const approveSpec = useCallback((sessionId: string) => {
    getSocket().emit('command:approve-spec', { sessionId });
  }, []);

  const rejectSpec = useCallback((sessionId: string, feedback: string) => {
    getSocket().emit('command:reject-spec', { sessionId, feedback });
  }, []);

  const abortTask = useCallback((sessionId: string) => {
    getSocket().emit('command:abort-task', { sessionId });
  }, []);

  return { createTask, approveSpec, rejectSpec, abortTask };
}
