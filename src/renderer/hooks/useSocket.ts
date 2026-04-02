import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store/sessionStore';

const SOCKET_URL = 'http://localhost:3333';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
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
    const socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      addEvent('Connected to Orchestra server', 'system');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      addEvent('Disconnected from Orchestra server', 'system');
    });

    // Session events
    socket.on('session:snapshot', (data: { session: any; agents: any[] }) => {
      setSession(data.session);
      setAgents(data.agents);
    });

    socket.on('session:created', (session: any) => {
      setSession(session);
      addEvent(`Task created: ${session.task.title}`, 'session');
    });

    socket.on('session:stage-changed', (data: { from: string; to: string }) => {
      updateStage(data.to as any);
      addEvent(`Pipeline: ${data.from} -> ${data.to}`, 'session');
    });

    socket.on('session:completed', (data: { taskId: string }) => {
      addEvent(`Task completed: ${data.taskId}`, 'session');
    });

    socket.on('session:failed', (data: { taskId: string; error: string }) => {
      addEvent(`Task failed: ${data.error}`, 'error');
    });

    // Agent events
    socket.on('agent:output', (message: any) => {
      addAgentOutput(message);
    });

    socket.on('agent:spawned', (data: { role: string; pid: number }) => {
      addEvent(`Agent spawned: ${data.role} (PID: ${data.pid})`, 'agent');
    });

    socket.on('agent:status-changed', (data: { role: string; status: string }) => {
      updateAgentStatus(data.role as any, data.status as any);
      addEvent(`Agent ${data.role}: ${data.status}`, 'agent');
    });

    socket.on('agent:exited', (data: { role: string; exitCode: number }) => {
      addEvent(`Agent ${data.role} exited (code: ${data.exitCode})`, 'agent');
    });

    // Artifact events
    socket.on('artifact:written', (data: { taskId: string; name: string }) => {
      addEvent(`Artifact written: ${data.name} (${data.taskId})`, 'artifact');
    });

    // Git events
    socket.on('git:branch-created', (data: { branch: string }) => {
      addEvent(`Branch created: ${data.branch}`, 'git');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef;
}

/**
 * Send a command to the backend via socket.
 */
export function useSocketCommands() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return {
    createTask: (title: string, description: string) => {
      socketRef.current?.emit('command:create-task', { title, description });
    },
    approveSpec: (sessionId: string) => {
      socketRef.current?.emit('command:approve-spec', { sessionId });
    },
    rejectSpec: (sessionId: string, feedback: string) => {
      socketRef.current?.emit('command:reject-spec', { sessionId, feedback });
    },
    abortTask: (sessionId: string) => {
      socketRef.current?.emit('command:abort-task', { sessionId });
    },
  };
}
