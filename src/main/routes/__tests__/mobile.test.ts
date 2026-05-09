/**
 * Mobile API router integration tests
 *
 * TDD: RED → written BEFORE the implementation exists.
 *
 * Uses Node.js built-in `fetch` (available in Node 18+) against a real Express
 * app listening on a random port. No supertest or additional deps needed.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'http';
import express from 'express';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';
import { UserStore } from '../../services/UserStore';
import { AuthService } from '../../services/AuthService';
import { DeviceStore } from '../../services/DeviceStore';
import { buildMobileRouter } from '../mobile';

const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';

function makeTmpPath(prefix: string): string {
  return path.join(
    os.tmpdir(),
    `orchestra-${prefix}-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}

let server: http.Server;
let baseUrl: string;
let authService: AuthService;
let deviceStore: DeviceStore;
let userStorePath: string;
let deviceStorePath: string;

// Pre-seeded user credentials
const TEST_USER_EMAIL = 'testuser@example.com';
const TEST_USER_PASSWORD = 'TestPass1234!';

async function seedUser() {
  try {
    await authService.signup(TEST_USER_EMAIL, TEST_USER_PASSWORD);
  } catch {
    // Already exists from previous test — fine
  }
}

async function getAuthToken(): Promise<string> {
  const result = await authService.loginMobile(TEST_USER_EMAIL, TEST_USER_PASSWORD);
  return result.token;
}

beforeAll(async () => {
  process.env.JWT_SECRET = TEST_SECRET;

  userStorePath = makeTmpPath('users');
  deviceStorePath = makeTmpPath('devices');

  const userStore = new UserStore(userStorePath);
  authService = new AuthService(userStore);
  deviceStore = new DeviceStore(deviceStorePath);

  await seedUser();

  const app = express();
  app.use(express.json());
  app.use('/api/mobile', buildMobileRouter(authService, deviceStore));

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });

  const address = server.address() as { port: number };
  baseUrl = `http://localhost:${address.port}/api/mobile`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /api/mobile/auth/login', () => {
  it('returns 200 with {token, expiresAt, userId} for valid credentials', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.token).toBe('string');
    expect(typeof body.expiresAt).toBe('string');
    expect(typeof body.userId).toBe('string');
  });

  it('token from login is a valid JWT with correct sub and email', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });

    const body = await res.json() as { token: string };
    const decoded = jwt.verify(body.token, TEST_SECRET) as Record<string, unknown>;
    expect(decoded.email).toBe(TEST_USER_EMAIL);
    expect(typeof decoded.sub).toBe('string');
  });

  it('returns 401 for wrong password with generic error message', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER_EMAIL, password: 'WrongPass!!' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid credentials');
  });

  it('returns 401 for non-existent user (no user enumeration)', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody@example.com', password: 'SomePass1!' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    // Same error message — no enumeration
    expect(body.error).toBe('Invalid credentials');
  });

  it('wrong-user and wrong-password return the same error message (no enumeration)', async () => {
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nobody@example.com', password: 'SomePass1!' }),
      }),
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: TEST_USER_EMAIL, password: 'WrongPass!!' }),
      }),
    ]);

    const [body1, body2] = await Promise.all([res1.json(), res2.json()]) as [
      { error: string },
      { error: string }
    ];
    expect(body1.error).toBe(body2.error);
  });
});

// ─── POST /devices/register ───────────────────────────────────────────────────

describe('POST /api/mobile/devices/register', () => {
  it('returns 200 with {deviceId, registered: true} for valid request', async () => {
    const token = await getAuthToken();

    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[abc123]',
        deviceId: 'device-uuid-test-001',
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json() as { deviceId: string; registered: boolean };
    expect(body.deviceId).toBe('device-uuid-test-001');
    expect(body.registered).toBe(true);
  });

  it('re-registering same deviceId updates in place (upsert)', async () => {
    const token = await getAuthToken();

    const deviceId = `device-upsert-${Date.now()}`;

    // First registration
    await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[token-v1]',
        deviceId,
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    // Second registration with updated token
    const res2 = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[token-v2]',
        deviceId,
        platform: 'ios',
        appVersion: '2.0.0',
      }),
    });

    expect(res2.status).toBe(200);

    // Verify only one record exists with updated token
    const devices = deviceStore.findByDeviceId(deviceId);
    expect(devices).toBeDefined();
    expect(devices!.expoPushToken).toBe('ExponentPushToken[token-v2]');
    expect(devices!.appVersion).toBe('2.0.0');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[abc]',
        deviceId: 'dev-no-auth',
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid/garbage token', async () => {
    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer not.a.valid.jwt',
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[abc]',
        deviceId: 'dev-bad-token',
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 401 for expired token', async () => {
    const expiredToken = jwt.sign(
      { sub: 'test-id', email: TEST_USER_EMAIL },
      TEST_SECRET,
      { expiresIn: -1 },
    );

    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${expiredToken}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[abc]',
        deviceId: 'dev-expired',
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 400 when required body fields are missing', async () => {
    const token = await getAuthToken();

    const res = await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        // Missing expoPushToken, platform, appVersion
        deviceId: 'dev-missing-fields',
      }),
    });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /devices/:deviceId ────────────────────────────────────────────────

describe('DELETE /api/mobile/devices/:deviceId', () => {
  it('returns 204 when deleting own device', async () => {
    const token = await getAuthToken();
    const deviceId = `device-to-delete-${Date.now()}`;

    // Register first
    await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[del-test]',
        deviceId,
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    // Delete
    const res = await fetch(`${baseUrl}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(204);

    // Verify removed from store
    expect(deviceStore.findByDeviceId(deviceId)).toBeUndefined();
  });

  it('returns 404 for non-existent device', async () => {
    const token = await getAuthToken();

    const res = await fetch(`${baseUrl}/devices/nonexistent-device-id`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Device not found');
  });

  it('returns 404 when attempting to delete another user\'s device (no leak)', async () => {
    // Create a second user with their own device
    const otherEmail = `other-${Date.now()}@example.com`;
    await authService.signup(otherEmail, 'OtherPass1234!');
    const otherResult = await authService.loginMobile(otherEmail, 'OtherPass1234!');
    const otherToken = otherResult.token;

    const deviceId = `other-device-${Date.now()}`;

    // Register device as "other" user
    await fetch(`${baseUrl}/devices/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherToken}`,
      },
      body: JSON.stringify({
        expoPushToken: 'ExponentPushToken[other]',
        deviceId,
        platform: 'ios',
        appVersion: '1.0.0',
      }),
    });

    // Try to delete as primary test user
    const primaryToken = await getAuthToken();
    const res = await fetch(`${baseUrl}/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${primaryToken}` },
    });

    expect(res.status).toBe(404);
  });

  it('returns 401 when auth header is missing', async () => {
    const res = await fetch(`${baseUrl}/devices/some-device`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(401);
  });
});

// ─── AC-B4: Mobile token accepted by same authService.verifyToken() ───────────

describe('AC-B4: mobile token compatibility', () => {
  it('a 30-day mobile token can be verified by authService.verifyToken() (same JWT middleware as web)', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER_EMAIL, password: TEST_USER_PASSWORD }),
    });

    const body = await res.json() as { token: string };

    // verifyToken() is what existing endpoints use — must accept mobile tokens
    expect(() => authService.verifyToken(body.token)).not.toThrow();
    const payload = authService.verifyToken(body.token);
    expect(payload.email).toBe(TEST_USER_EMAIL);
    expect(typeof payload.sub).toBe('string');
  });
});
