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
    });

    s.on('session:created', (session: any) => {
      setSession(session);
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

  const approveMerge = useCallback((sessionId: string) => {
    getSocket().emit('command:approve-merge', { sessionId });
  }, []);

  const rejectMerge = useCallback((sessionId: string, feedback: string) => {
    getSocket().emit('command:reject-merge', { sessionId, feedback });
  }, []);

  return { createTask, approveSpec, rejectSpec, abortTask, approveMerge, rejectMerge };
}
