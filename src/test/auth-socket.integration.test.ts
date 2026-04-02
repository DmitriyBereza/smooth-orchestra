/**
 * Integration test: Socket.io authentication gate
 *
 * Spins up a real SocketServer with a real AuthService backed by a temp
 * UserStore, connects socket.io-client instances, and verifies that:
 *   - Connections without a JWT are rejected.
 *   - Connections with an invalid JWT are rejected.
 *   - Connections with a valid JWT succeed and receive session:snapshot.
 *   - Connections with an expired JWT are rejected.
 *
 * Uses port 0 so the OS picks a free port, avoiding conflicts.
 * SessionManager and AgentPool are minimal stubs — auth middleware runs
 * before any business logic, so those services are never called during
 * a rejected handshake.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import { SocketServer } from '../main/services/SocketServer';
import { UserStore } from '../main/services/UserStore';
import { AuthService } from '../main/services/AuthService';
import type { SessionManager } from '../main/services/SessionManager';
import type { AgentPool } from '../main/services/AgentPool';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_SECRET = 'integration-test-secret-abc123-xyz!';

function makeTmpPath(): string {
  return path.join(
    os.tmpdir(),
    `orchestra-int-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}

/**
 * Minimal stubs for SessionManager and AgentPool.
 * Auth middleware fires before any session/agent logic, so these are
 * never actually invoked during a rejected handshake. For the accepted
 * connection test, session:snapshot is emitted by SocketServer with the
 * stub values.
 */
const stubAgentPool = {
  getAllAgentInfo: () => [],
} as unknown as AgentPool;

const stubSessionManager = {
  getSession: () => null,
} as unknown as SessionManager;

// ─── Test setup ───────────────────────────────────────────────────────────────

let socketServer: SocketServer;
let serverUrl: string;
let authService: AuthService;

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  const store = new UserStore(makeTmpPath());
  authService = new AuthService(store);

  // Port 0 → OS assigns a free port
  socketServer = new SocketServer(stubSessionManager, stubAgentPool, authService, 0);
  await socketServer.start();

  const port = socketServer.getPort();
  serverUrl = `http://localhost:${port}`;
});

afterAll(async () => {
  await socketServer.stop();
  delete process.env.JWT_SECRET;
});

// ─── Utility: connect with a given auth token (or none) ──────────────────────

function connectWith(
  token: string | undefined,
  timeoutMs = 3000,
): Promise<{ connected: boolean; errorMessage?: string; socket: ClientSocket }> {
  return new Promise((resolve) => {
    const socket = ioClient(serverUrl, {
      auth: token !== undefined ? { token } : {},
      reconnection: false,
      timeout: timeoutMs,
    });

    const timer = setTimeout(() => {
      socket.disconnect();
      resolve({ connected: false, errorMessage: 'timeout', socket });
    }, timeoutMs);

    socket.on('connect', () => {
      clearTimeout(timer);
      resolve({ connected: true, socket });
    });

    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      socket.disconnect();
      resolve({ connected: false, errorMessage: err.message, socket });
    });
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Socket.io auth gate', () => {
  it('AC8 — rejects a connection that provides no token', async () => {
    const { connected, errorMessage, socket } = await connectWith(undefined);
    socket.disconnect();

    expect(connected).toBe(false);
    expect(errorMessage).toBe('401');
  });

  it('AC8 — rejects a connection with a garbage/invalid token', async () => {
    const { connected, errorMessage, socket } = await connectWith('not.a.valid.jwt');
    socket.disconnect();

    expect(connected).toBe(false);
    expect(errorMessage).toBe('401');
  });

  it('AC8 — rejects a connection with an expired token', async () => {
    const expiredToken = jwt.sign(
      { sub: 'test-id', email: 'expired@example.com' },
      TEST_SECRET,
      { expiresIn: -1 }, // Already expired at the moment of creation
    );
    const { connected, errorMessage, socket } = await connectWith(expiredToken);
    socket.disconnect();

    expect(connected).toBe(false);
    expect(errorMessage).toBe('401');
  });

  it('AC8 — rejects a token signed with a different secret', async () => {
    const foreignToken = jwt.sign(
      { sub: 'test-id', email: 'foreign@example.com' },
      'a-completely-different-secret',
      { expiresIn: '1h' },
    );
    const { connected, errorMessage, socket } = await connectWith(foreignToken);
    socket.disconnect();

    expect(connected).toBe(false);
    expect(errorMessage).toBe('401');
  });

  it('AC9 — accepts a connection with a valid JWT and emits session:snapshot', async () => {
    // Sign up and log in to get a real token
    await authService.signup('integration@example.com', 'ValidPass123!');
    const token = await authService.login('integration@example.com', 'ValidPass123!');

    // Register session:snapshot listener BEFORE connect fires so we don't race.
    await new Promise<void>((resolve, reject) => {
      const socket = ioClient(serverUrl, {
        auth: { token },
        reconnection: false,
        timeout: 3000,
      });

      const timer = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timed out waiting for session:snapshot'));
      }, 3000);

      socket.on('connect_error', (err: Error) => {
        clearTimeout(timer);
        socket.disconnect();
        reject(new Error(`Connection rejected: ${err.message}`));
      });

      socket.on('session:snapshot', () => {
        clearTimeout(timer);
        socket.disconnect();
        resolve();
      });
    });
    // If the promise resolves, the connection was accepted and snapshot was received
  });
});
