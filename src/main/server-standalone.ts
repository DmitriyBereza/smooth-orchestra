/**
 * Standalone server mode — runs the Orchestra backend without Electron.
 * Use this for development with a regular browser at http://localhost:5173
 *
 * Usage: npm run dev:web
 */
import path from 'path';
import fs from 'fs';
import {
  AgentPool,
  ArtifactManager,
  AuthService,
  EventLogger,
  FileLockManager,
  GitManager,
  SessionManager,
  SocketServer,
  UserStore,
} from './services';

const projectPath = process.cwd();
const orchestraDir = path.join(projectPath, '.orchestra');

// Ensure .orchestra directory structure exists
function ensureOrchestraDir(): void {
  const dirs = [
    orchestraDir,
    path.join(orchestraDir, 'tasks'),
    path.join(orchestraDir, 'locks'),
    path.join(orchestraDir, 'logs'),
    path.join(orchestraDir, 'templates'),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

async function main(): Promise<void> {
  console.log('[Orchestra] Starting standalone server...');
  console.log(`[Orchestra] Project path: ${projectPath}`);

  ensureOrchestraDir();

  // Initialize auth services
  const userStorePath = path.join(orchestraDir, 'users.json');
  const userStore = new UserStore(userStorePath);
  const authService = new AuthService(userStore);

  // Initialize services
  const fileLockManager = new FileLockManager(orchestraDir);
  const gitManager = new GitManager(projectPath);
  const artifactManager = new ArtifactManager(orchestraDir);
  const agentPool = new AgentPool();

  const sessionManager = new SessionManager(
    agentPool,
    artifactManager,
    gitManager,
    projectPath,
  );

  // Load project context if it exists
  const projectMdPath = path.join(orchestraDir, 'project.md');
  if (fs.existsSync(projectMdPath)) {
    sessionManager.setProjectContext(fs.readFileSync(projectMdPath, 'utf-8'));
  }

  // Initialize event logger
  const eventLogger = new EventLogger(orchestraDir);

  // Start socket server (with auth and event logger)
  const socketServer = new SocketServer(sessionManager, agentPool, authService, undefined, eventLogger);
  await socketServer.start();

  console.log('[Orchestra] Server ready. Open http://localhost:5173 in your browser.');
  console.log('[Orchestra] Socket.io listening on port 3333');
  console.log('[Orchestra] Auth endpoints available at /auth/signup and /auth/login');
  console.log(`[Orchestra] User store: ${userStorePath}`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Orchestra] Shutting down...');
    agentPool.killAll();
    await socketServer.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    agentPool.killAll();
    await socketServer.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('[Orchestra] Fatal error:', err);
  process.exit(1);
});
