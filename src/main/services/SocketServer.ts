import http from 'http';
import express, { Router, Request, Response } from 'express';
import cors from 'cors';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { eventBus } from './EventBus';
import { SessionManager } from './SessionManager';
import { AgentPool } from './AgentPool';
import { ArtifactManager } from './ArtifactManager';
import { AuthService, SignupError, LoginError } from './AuthService';
import { EventLogger } from './EventLogger';
import { ProjectStore } from './ProjectStore';
import { ProjectRecord } from '../types/project';
import { ArtifactType, ARTIFACT_FILENAMES } from '../types/artifacts';

// ─── Auth router ─────────────────────────────────────────────────────────────

/**
 * Builds an Express Router that handles:
 *   POST /auth/signup  → AuthService.signup()
 *   POST /auth/login   → AuthService.login()
 */
function buildAuthRouter(authService: AuthService): Router {
  const router = Router();

  // POST /auth/signup
  router.post('/signup', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    try {
      await authService.signup(email ?? '', password ?? '');
      res.status(201).json({ message: 'User created' });
    } catch (err) {
      if (err instanceof SignupError) {
        if (err.code === 'DUPLICATE') {
          res.status(409).json({ error: 'Email already registered' });
        } else {
          // VALIDATION
          res.status(400).json({ error: err.message });
        }
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // POST /auth/login
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };

    try {
      const token = await authService.login(email ?? '', password ?? '');
      res.status(200).json({ token });
    } catch (err) {
      if (err instanceof LoginError) {
        res.status(401).json({ error: 'Invalid credentials' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  return router;
}

// ─── Projects router ─────────────────────────────────────────────────────────

function buildProjectRouter(projectStore: ProjectStore): Router {
  const router = Router();

  // GET /projects — list all projects
  router.get('/', (_req: Request, res: Response) => {
    res.json(projectStore.all());
  });

  // GET /projects/:id
  router.get('/:id', (req: Request, res: Response) => {
    const project = projectStore.findById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(project);
  });

  // POST /projects — create a new project
  router.post('/', (req: Request, res: Response) => {
    const { name, path: projectPath, labels } = req.body as {
      name?: string;
      path?: string;
      labels?: string[];
    };

    if (!name?.trim() || !projectPath?.trim()) {
      res.status(400).json({ error: 'name and path are required' });
      return;
    }

    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: uuid(),
      name: name.trim(),
      path: projectPath.trim(),
      labels: (labels ?? []).map((l) => l.trim()).filter(Boolean),
      createdAt: now,
      updatedAt: now,
    };

    projectStore.save(project);
    res.status(201).json(project);
  });

  // PUT /projects/:id — update a project
  router.put('/:id', (req: Request, res: Response) => {
    const existing = projectStore.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { name, path: projectPath, labels } = req.body as {
      name?: string;
      path?: string;
      labels?: string[];
    };

    const updated: ProjectRecord = {
      ...existing,
      name: name?.trim() ?? existing.name,
      path: projectPath?.trim() ?? existing.path,
      labels: labels !== undefined
        ? labels.map((l) => l.trim()).filter(Boolean)
        : existing.labels,
      updatedAt: new Date().toISOString(),
    };

    projectStore.save(updated);
    res.json(updated);
  });

  // DELETE /projects/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const deleted = projectStore.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(204).send();
  });

  return router;
}

// ─── SocketServer ─────────────────────────────────────────────────────────────

/**
 * Socket.io server that bridges backend events to the React frontend.
 * Forwards EventBus events to connected clients and routes client commands back.
 *
 * When an AuthService is provided:
 *   - Mounts POST /auth/signup and POST /auth/login on Express.
 *   - Requires a valid JWT in socket.handshake.auth.token for all Socket.io
 *     connections (rejects with a '401' error otherwise).
 */
export class SocketServer {
  private io: SocketIOServer;
  private httpServer: http.Server;

  constructor(
    private sessionManager: SessionManager,
    private agentPool: AgentPool,
    private authService?: AuthService,
    private port: number = Number(process.env.AUTH_PORT) || 3333,
    private eventLogger?: EventLogger,
    private projectStore?: ProjectStore,
    private artifactManager?: ArtifactManager,
  ) {
    // Create Express app and attach it as the HTTP request handler so that
    // REST endpoints and Socket.io share a single port.
    const app = express();
    app.use(express.json());
    app.use(cors({ origin: true, methods: ['GET', 'POST', 'PUT', 'DELETE'] }));

    this.httpServer = http.createServer(app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: { origin: true, methods: ['GET', 'POST'] },
    });

    // Mount auth REST routes (only when AuthService is injected)
    if (this.authService) {
      app.use('/auth', buildAuthRouter(this.authService));
    }

    // Mount project REST routes
    if (this.projectStore) {
      app.use('/api/projects', buildProjectRouter(this.projectStore));
    }

    if (this.eventLogger) {
      const eventLogger = this.eventLogger;
      app.get('/api/events', (req: Request, res: Response) => {
        const filters = {
          category: req.query.category as string | undefined,
          role: req.query.role as string | undefined,
          taskId: req.query.taskId as string | undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        };
        res.json(eventLogger.getEvents(filters));
      });
    }

    // Artifact content endpoint
    if (this.artifactManager) {
      const am = this.artifactManager;

      // GET /api/artifacts/:taskId/:type — fetch artifact content
      app.get('/api/artifacts/:taskId/:type', (req: Request, res: Response) => {
        const { taskId, type } = req.params;
        if (!(type in ARTIFACT_FILENAMES)) {
          res.status(400).json({ error: `Unknown artifact type: ${type}` });
          return;
        }
        const content = am.readArtifact(taskId, type as ArtifactType);
        if (content === null) {
          res.status(404).json({ error: 'Artifact not found' });
          return;
        }
        res.json({ taskId, type, content });
      });

      // GET /api/artifacts/:taskId — list all artifacts for a task
      app.get('/api/artifacts/:taskId', (req: Request, res: Response) => {
        const { taskId } = req.params;
        const artifacts = am.listArtifacts(taskId);
        res.json(artifacts);
      });
    }

    // Socket.io JWT middleware — runs BEFORE any event handler
    if (this.authService) {
      this.io.use((socket: Socket, next) => {
        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          return next(new Error('401'));
        }
        try {
          this.authService!.verifyToken(token);
          next();
        } catch {
          next(new Error('401'));
        }
      });
    }

    this.setupEventForwarding();
    this.setupClientHandlers();
  }

  // ─── Public API ──────────────────────────────────────────────────────────

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
   * Returns the actual port the HTTP server is listening on.
   * Useful in tests when the server is started with port 0 (OS-assigned).
   */
  getPort(): number {
    const addr = this.httpServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Server is not listening or address is a pipe/socket');
    }
    return addr.port;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

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

    // Subtask events (parallel dev)
    eventBus.on('session:subtask-started', (data) => {
      this.io.emit('session:subtask-started', data);
    });

    eventBus.on('session:subtask-completed', (data) => {
      this.io.emit('session:subtask-completed', data);
    });

    eventBus.on('session:subtask-failed', (data) => {
      this.io.emit('session:subtask-failed', data);
    });

    eventBus.on('session:all-subtasks-completed', (data) => {
      this.io.emit('session:all-subtasks-completed', data);
    });

    // Artifact events
    eventBus.on('artifact:written', (data) => {
      this.io.emit('artifact:written', data);
    });

    // Git events
    eventBus.on('git:branch-created', (data) => {
      this.io.emit('git:branch-created', data);
    });

    eventBus.on('session:qa-rejection', (data) => {
      this.io.emit('session:qa-rejection', data);
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

      // Send project list on connect
      if (this.projectStore) {
        socket.emit('projects:list', this.projectStore.all());
      }

      // Route commands to EventBus
      socket.on('command:create-task', (data: { title: string; description: string; projectIds?: string[]; scheduledAt?: string; models?: Record<string, string> }) => {
        console.log(`[SocketServer] Received command:create-task`, data);
        eventBus.emit('command:create-task', data);
      });

      // Project management via socket (for real-time sync)
      socket.on('projects:request-list', () => {
        if (this.projectStore) {
          socket.emit('projects:list', this.projectStore.all());
        }
      });

      socket.on('command:approve-spec', (data: { sessionId: string }) => {
        eventBus.emit('command:approve-spec', data);
      });

      socket.on('command:reject-spec', (data: { sessionId: string; feedback: string }) => {
        eventBus.emit('command:reject-spec', data);
      });

      socket.on('command:answer-questions', (data: { sessionId: string; answers: string }) => {
        eventBus.emit('command:answer-questions', data);
      });

      socket.on('command:abort-task', (data: { sessionId: string }) => {
        eventBus.emit('command:abort-task', data);
      });

      socket.on('command:route-rejection', (data: { sessionId: string; routing: 'send_to_dev' | 'escalate_to_po' }) => {
        eventBus.emit('command:route-rejection', data);
      });

      socket.on('command:approve-merge', (data: { sessionId: string }) => {
        eventBus.emit('command:approve-merge', data);
      });

      socket.on('command:reject-merge', (data: { sessionId: string; feedback: string }) => {
        eventBus.emit('command:reject-merge', data);
      });

      socket.on('disconnect', () => {
        console.log(`[SocketServer] Client disconnected: ${socket.id}`);
      });
    });
  }
}
