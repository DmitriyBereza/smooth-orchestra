import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { eventBus } from './EventBus';
import { SessionManager } from './SessionManager';
import { AgentPool } from './AgentPool';

/**
 * Socket.io server that bridges backend events to the React frontend.
 * Forwards EventBus events to connected clients and routes client commands back.
 */
export class SocketServer {
  private io: SocketIOServer;
  private httpServer: http.Server;

  constructor(
    private sessionManager: SessionManager,
    private agentPool: AgentPool,
    private port: number = 3333,
  ) {
    this.httpServer = http.createServer();
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventForwarding();
    this.setupClientHandlers();
  }

  /**
   * Start listening on the configured port.
   */
  start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`[SocketServer] Listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server.
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        this.httpServer.close(() => {
          resolve();
        });
      });
    });
  }

  /**
   * Subscribe to EventBus events and forward them to all connected clients.
   */
  private setupEventForwarding(): void {
    // Agent events
    eventBus.on('agent:output', (message) => {
      this.io.emit('agent:output', message);
    });

    eventBus.on('agent:status-changed', (data) => {
      this.io.emit('agent:status-changed', data);
    });

    eventBus.on('agent:spawned', (data) => {
      this.io.emit('agent:spawned', data);
    });

    eventBus.on('agent:exited', (data) => {
      this.io.emit('agent:exited', data);
    });

    // Session events
    eventBus.on('session:created', (session) => {
      this.io.emit('session:created', session);
    });

    eventBus.on('session:stage-changed', (data) => {
      this.io.emit('session:stage-changed', data);
    });

    eventBus.on('session:completed', (data) => {
      this.io.emit('session:completed', data);
    });

    eventBus.on('session:failed', (data) => {
      this.io.emit('session:failed', data);
    });

    // Artifact events
    eventBus.on('artifact:written', (data) => {
      this.io.emit('artifact:written', data);
    });

    // Git events
    eventBus.on('git:branch-created', (data) => {
      this.io.emit('git:branch-created', data);
    });
  }

  /**
   * Handle commands from connected clients.
   */
  private setupClientHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[SocketServer] Client connected: ${socket.id}`);

      // Send current state snapshot
      const session = this.sessionManager.getSession();
      socket.emit('session:snapshot', {
        session,
        agents: this.agentPool.getAllAgentInfo(),
      });

      // Route commands to EventBus
      socket.on('command:create-task', (data: { title: string; description: string }) => {
        eventBus.emit('command:create-task', data);
      });

      socket.on('command:approve-spec', (data: { sessionId: string }) => {
        eventBus.emit('command:approve-spec', data);
      });

      socket.on('command:reject-spec', (data: { sessionId: string; feedback: string }) => {
        eventBus.emit('command:reject-spec', data);
      });

      socket.on('command:abort-task', (data: { sessionId: string }) => {
        eventBus.emit('command:abort-task', data);
      });

      socket.on('disconnect', () => {
        console.log(`[SocketServer] Client disconnected: ${socket.id}`);
      });
    });
  }
}
