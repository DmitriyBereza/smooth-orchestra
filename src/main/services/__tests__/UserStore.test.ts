/**
 * UserStore unit tests
 *
 * TDD: RED → these tests are written BEFORE the implementation exists.
 * All tests write to os.tmpdir() and never touch .orchestra/.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { UserStore } from '../UserStore';
import type { UserRecord } from '../../types/auth';

function makeTmpPath(): string {
  return path.join(os.tmpdir(), `orchestra-userstore-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

function makeUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: `test-id-${Math.random().toString(36).slice(2)}`,
    email: 'user@example.com',
    passwordHash: '$2b$10$dummyhashvalue',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('UserStore', () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = makeTmpPath();
    // Ensure clean state: file does not exist before each test
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  });

  describe('constructor', () => {
    it('creates the JSON file with an empty array if it does not exist', () => {
      new UserStore(tmpPath);
      expect(fs.existsSync(tmpPath)).toBe(true);
      const raw = fs.readFileSync(tmpPath, 'utf-8');
      expect(JSON.parse(raw)).toEqual([]);
    });

    it('does not overwrite an existing file', () => {
      const existing: UserRecord[] = [makeUser({ id: 'pre-existing' })];
      fs.writeFileSync(tmpPath, JSON.stringify(existing), 'utf-8');
      new UserStore(tmpPath);
      const store = new UserStore(tmpPath);
      expect(store.all()).toHaveLength(1);
      expect(store.all()[0].id).toBe('pre-existing');
    });
  });

  describe('save()', () => {
    it('persists a user so that all() returns it on a fresh store instance', () => {
      const store1 = new UserStore(tmpPath);
      const user = makeUser({ email: 'alice@example.com' });
      store1.save(user);

      // Create a fresh instance to verify persistence (simulates restart)
      const store2 = new UserStore(tmpPath);
      expect(store2.all()).toHaveLength(1);
      expect(store2.all()[0].id).toBe(user.id);
      expect(store2.all()[0].email).toBe(user.email);
    });

    it('upserts (updates) a user with the same id rather than duplicating', () => {
      const store = new UserStore(tmpPath);
      const user = makeUser({ id: 'fixed-id', email: 'original@example.com' });
      store.save(user);
      store.save({ ...user, email: 'updated@example.com' });

      const all = store.all();
      expect(all).toHaveLength(1);
      expect(all[0].email).toBe('updated@example.com');
    });

    it('appends multiple distinct users', () => {
      const store = new UserStore(tmpPath);
      store.save(makeUser({ id: 'id-1', email: 'a@example.com' }));
      store.save(makeUser({ id: 'id-2', email: 'b@example.com' }));
      store.save(makeUser({ id: 'id-3', email: 'c@example.com' }));
      expect(store.all()).toHaveLength(3);
    });

    it('uses atomic write (tmp file then rename) so .tmp file is cleaned up', () => {
      const store = new UserStore(tmpPath);
      store.save(makeUser());
      // After the save, the .tmp file should NOT exist
      expect(fs.existsSync(`${tmpPath}.tmp`)).toBe(false);
    });
  });

  describe('findByEmail()', () => {
    it('returns the user record for a known email', () => {
      const store = new UserStore(tmpPath);
      const user = makeUser({ email: 'alice@example.com' });
      store.save(user);
      const found = store.findByEmail('alice@example.com');
      expect(found).toBeDefined();
      expect(found!.id).toBe(user.id);
    });

    it('returns undefined for an unknown email', () => {
      const store = new UserStore(tmpPath);
      store.save(makeUser({ email: 'alice@example.com' }));
      expect(store.findByEmail('nobody@example.com')).toBeUndefined();
    });

    it('is case-insensitive: finds user regardless of email casing', () => {
      const store = new UserStore(tmpPath);
      store.save(makeUser({ email: 'alice@example.com' }));
      expect(store.findByEmail('ALICE@EXAMPLE.COM')).toBeDefined();
      expect(store.findByEmail('Alice@Example.Com')).toBeDefined();
    });
  });

  describe('findById()', () => {
    it('returns the user record for a known id', () => {
      const store = new UserStore(tmpPath);
      const user = makeUser({ id: 'known-id' });
      store.save(user);
      expect(store.findById('known-id')).toBeDefined();
      expect(store.findById('known-id')!.email).toBe(user.email);
    });

    it('returns undefined for an unknown id', () => {
      const store = new UserStore(tmpPath);
      store.save(makeUser({ id: 'id-a' }));
      expect(store.findById('id-unknown')).toBeUndefined();
    });
  });

  describe('all()', () => {
    it('returns an empty array when the store is empty', () => {
      const store = new UserStore(tmpPath);
      expect(store.all()).toEqual([]);
    });

    it('reads fresh from disk on each call (no stale in-memory cache)', () => {
      const store1 = new UserStore(tmpPath);
      const store2 = new UserStore(tmpPath); // separate instance, same file

      store1.save(makeUser({ id: 'a', email: 'a@example.com' }));
      // store2 should reflect the change even though it didn't save
      expect(store2.all()).toHaveLength(1);
    });
  });
});
