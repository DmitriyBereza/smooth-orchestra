import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  AgentPool,
  ArtifactManager,
  FileLockManager,
  GitManager,
  SessionManager,
  SocketServer,
} from './services';

const isDev = !app.isPackaged;

// Default project path — can be configured via UI
let projectPath = process.cwd();
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

let mainWindow: BrowserWindow | null = null;
let socketServer: SocketServer | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Orchestra — AI Dev Team',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#0f172a',
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function bootstrap(): Promise<void> {
  ensureOrchestraDir();

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

  // Start socket server
  socketServer = new SocketServer(sessionManager, agentPool);
  await socketServer.start();

  // Create the Electron window
  await createWindow();
}

app.whenReady().then(bootstrap);

app.on('window-all-closed', async () => {
  if (socketServer) {
    await socketServer.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
