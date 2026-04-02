/**
 * AuthService unit tests
 *
 * TDD: RED → these tests are written BEFORE the implementation exists.
 * All tests use a temp UserStore backed by os.tmpdir() — never .orchestra/.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { AuthService, SignupError, LoginError } from '../AuthService';
import { UserStore } from '../UserStore';

function makeTmpPath(): string {
  return path.join(
    os.tmpdir(),
    `orchestra-authservice-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}

function makeAuthService(): { service: AuthService; store: UserStore } {
  const tmpPath = makeTmpPath();
  const store = new UserStore(tmpPath);
  const service = new AuthService(store);
  return { service, store };
}

describe('AuthService', () => {
  // Ensure a deterministic JWT secret is set for all tests in this file
  const TEST_SECRET = 'test-secret-at-least-32-characters-long!!';

  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  // ─── signup() ────────────────────────────────────────────────────────────

  describe('signup()', () => {
    it('happy path: stores the user with a hashed password (never plaintext)', async () => {
      const { service, store } = makeAuthService();
      await service.signup('alice@example.com', 'securePass1');

      const user = store.findByEmail('alice@example.com');
      expect(user).toBeDefined();
      expect(user!.email).toBe('alice@example.com');
      // Password must be hashed, not stored as-is
      expect(user!.passwordHash).not.toBe('securePass1');
      // bcrypt hashes start with $2b$ (native bcrypt) or $2a$ (bcryptjs)
      expect(user!.passwordHash).toMatch(/^\$2[ab]\$/);
    });

    it('happy path: assigns a uuid id and ISO createdAt', async () => {
      const { service, store } = makeAuthService();
      await service.signup('bob@example.com', 'anotherPass1');

      const user = store.findByEmail('bob@example.com');
      expect(user).toBeDefined();
      expect(typeof user!.id).toBe('string');
      expect(user!.id.length).toBeGreaterThan(0);
      // createdAt should be a valid ISO date string
      expect(() => new Date(user!.createdAt).toISOString()).not.toThrow();
    });

    it('throws SignupError with code DUPLICATE if email already registered', async () => {
      const { service } = makeAuthService();
      await service.signup('carol@example.com', 'Pass1234!');

      await expect(service.signup('carol@example.com', 'AnotherPass!'))
        .rejects.toMatchObject({ code: 'DUPLICATE' });
    });

    it('DUPLICATE check is case-insensitive', async () => {
      const { service } = makeAuthService();
      await service.signup('dave@example.com', 'Pass1234!');

      await expect(service.signup('DAVE@EXAMPLE.COM', 'Pass1234!'))
        .rejects.toMatchObject({ code: 'DUPLICATE' });
    });

    it('throws SignupError with code VALIDATION for missing email', async () => {
      const { service } = makeAuthService();
      await expect(service.signup('', 'ValidPass1'))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('throws SignupError with code VALIDATION for malformed email', async () => {
      const { service } = makeAuthService();
      await expect(service.signup('not-an-email', 'ValidPass1'))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('throws SignupError with code VALIDATION for password shorter than 8 characters', async () => {
      const { service } = makeAuthService();
      await expect(service.signup('eve@example.com', 'short'))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('throws SignupError with code VALIDATION for missing password', async () => {
      const { service } = makeAuthService();
      await expect(service.signup('frank@example.com', ''))
        .rejects.toMatchObject({ code: 'VALIDATION' });
    });

    it('throws instances of SignupError', async () => {
      const { service } = makeAuthService();
      try {
        await service.signup('', 'ValidPass1');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(SignupError);
      }
    });
  });

  // ─── login() ─────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('happy path: returns a JWT string for valid credentials', async () => {
      const { service } = makeAuthService();
      await service.signup('grace@example.com', 'GoodPass1!');
      const token = await service.login('grace@example.com', 'GoodPass1!');

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('JWT payload contains sub, email, iat, and exp', async () => {
      const { service } = makeAuthService();
      await service.signup('heidi@example.com', 'GoodPass1!');
      const token = await service.login('heidi@example.com', 'GoodPass1!');

      const decoded = jwt.verify(token, TEST_SECRET) as Record<string, unknown>;
      expect(typeof decoded.sub).toBe('string');
      expect(decoded.email).toBe('heidi@example.com');
      expect(typeof decoded.iat).toBe('number');
      expect(typeof decoded.exp).toBe('number');
    });

    it('JWT expires in approximately 24 hours', async () => {
      const { service } = makeAuthService();
      await service.signup('ivan@example.com', 'GoodPass1!');
      const token = await service.login('ivan@example.com', 'GoodPass1!');

      const decoded = jwt.decode(token) as { iat: number; exp: number };
      const diffSeconds = decoded.exp - decoded.iat;
      // Should be 24h ± 5 seconds
      expect(diffSeconds).toBeGreaterThanOrEqual(24 * 60 * 60 - 5);
      expect(diffSeconds).toBeLessThanOrEqual(24 * 60 * 60 + 5);
    });

    it('throws LoginError with code INVALID_CREDENTIALS for wrong password', async () => {
      const { service } = makeAuthService();
      await service.signup('judy@example.com', 'CorrectPass1');

      await expect(service.login('judy@example.com', 'WrongPass1'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws LoginError with code INVALID_CREDENTIALS for unknown email', async () => {
      const { service } = makeAuthService();

      await expect(service.login('nobody@example.com', 'SomePass1!'))
        .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('throws instances of LoginError', async () => {
      const { service } = makeAuthService();
      try {
        await service.login('nobody@example.com', 'SomePass1!');
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LoginError);
      }
    });

    it('does not leak which field was wrong (same error for bad email vs bad password)', async () => {
      const { service } = makeAuthService();
      await service.signup('kate@example.com', 'CorrectPass1');

      const errBadEmail = await service.login('wrong@example.com', 'CorrectPass1').catch(e => e);
      const errBadPass = await service.login('kate@example.com', 'WrongPass!!').catch(e => e);

      expect(errBadEmail.code).toBe('INVALID_CREDENTIALS');
      expect(errBadPass.code).toBe('INVALID_CREDENTIALS');
      // Both should have the same error message (not revealing which field was wrong)
      expect(errBadEmail.message).toBe(errBadPass.message);
    });
  });

  // ─── verifyToken() ───────────────────────────────────────────────────────

  describe('verifyToken()', () => {
    it('returns decoded payload for a valid token', async () => {
      const { service } = makeAuthService();
      await service.signup('lena@example.com', 'ValidPass1!');
      const token = await service.login('lena@example.com', 'ValidPass1!');

      const payload = service.verifyToken(token);
      expect(payload.email).toBe('lena@example.com');
      expect(typeof payload.sub).toBe('string');
    });

    it('throws for a garbage/invalid token string', () => {
      const { service } = makeAuthService();
      expect(() => service.verifyToken('not.a.jwt')).toThrow();
    });

    it('throws for an empty string', () => {
      const { service } = makeAuthService();
      expect(() => service.verifyToken('')).toThrow();
    });

    it('throws for an expired token', () => {
      const { service } = makeAuthService();
      // Manually create an already-expired token (expiresIn: 0 is not quite right,
      // so we set exp to a past timestamp directly)
      const expiredToken = jwt.sign(
        { sub: 'test-id', email: 'test@example.com' },
        TEST_SECRET,
        { expiresIn: -1 }, // Already expired
      );
      expect(() => service.verifyToken(expiredToken)).toThrow();
    });

    it('throws for a token signed with a different secret', () => {
      const { service } = makeAuthService();
      const foreignToken = jwt.sign(
        { sub: 'test-id', email: 'test@example.com' },
        'wrong-secret-entirely',
        { expiresIn: '1h' },
      );
      expect(() => service.verifyToken(foreignToken)).toThrow();
    });
  });

  // ─── JWT_SECRET env var ───────────────────────────────────────────────────

  describe('JWT_SECRET environment variable', () => {
    it('uses JWT_SECRET from environment when set', async () => {
      process.env.JWT_SECRET = 'my-explicit-secret-value-abc123';
      const { service } = makeAuthService();
      await service.signup('mallory@example.com', 'ValidPass1!');
      const token = await service.login('mallory@example.com', 'ValidPass1!');

      // Token should be verifiable with the explicit secret
      expect(() => jwt.verify(token, 'my-explicit-secret-value-abc123')).not.toThrow();
    });

    it('falls back to an ephemeral secret and logs a warning when JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: unknown[]) => warnings.push(args.join(' '));

      try {
        const { service } = makeAuthService();
        await service.signup('nick@example.com', 'ValidPass1!');
        const token = await service.login('nick@example.com', 'ValidPass1!');

        // Token must still be valid (verifiable by the same service instance)
        expect(() => service.verifyToken(token)).not.toThrow();
        // Warning must have been emitted
        expect(warnings.some(w => w.includes('[Auth]') && w.includes('JWT_SECRET'))).toBe(true);
      } finally {
        console.warn = originalWarn;
        process.env.JWT_SECRET = TEST_SECRET; // restore
      }
    });
  });
});
