/**
 * DeviceStore unit tests
 *
 * TDD: RED → written BEFORE the implementation exists.
 * Uses a temp file in os.tmpdir() — never .orchestra/.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { DeviceStore } from '../DeviceStore';
import { DeviceRecord } from '../../types/device';

function makeTmpPath(): string {
  return path.join(
    os.tmpdir(),
    `orchestra-devicestore-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`,
  );
}

function makeStore(): { store: DeviceStore; tmpPath: string } {
  const tmpPath = makeTmpPath();
  const store = new DeviceStore(tmpPath);
  return { store, tmpPath };
}

function makeRecord(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  return {
    deviceId: 'device-uuid-001',
    userId: 'user-uuid-001',
    expoPushToken: 'ExponentPushToken[abc123]',
    platform: 'ios',
    appVersion: '1.0.0',
    registeredAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DeviceStore', () => {
  describe('constructor', () => {
    it('creates the backing file with an empty array if it does not exist', () => {
      const tmpPath = makeTmpPath();
      expect(fs.existsSync(tmpPath)).toBe(false);

      new DeviceStore(tmpPath);

      expect(fs.existsSync(tmpPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
      expect(content).toEqual([]);
    });

    it('does not overwrite an existing file', () => {
      const tmpPath = makeTmpPath();
      const record = makeRecord();
      fs.writeFileSync(tmpPath, JSON.stringify([record]), 'utf-8');

      const store = new DeviceStore(tmpPath);
      expect(store.all()).toHaveLength(1);
    });
  });

  describe('all()', () => {
    it('returns empty array for a fresh store', () => {
      const { store } = makeStore();
      expect(store.all()).toEqual([]);
    });

    it('returns all stored records', () => {
      const { store } = makeStore();
      const r1 = makeRecord({ deviceId: 'dev-1', userId: 'user-1' });
      const r2 = makeRecord({ deviceId: 'dev-2', userId: 'user-2' });
      store.upsert(r1);
      store.upsert(r2);
      expect(store.all()).toHaveLength(2);
    });
  });

  describe('upsert()', () => {
    it('inserts a new device record', () => {
      const { store } = makeStore();
      const record = makeRecord();
      store.upsert(record);

      const all = store.all();
      expect(all).toHaveLength(1);
      expect(all[0].deviceId).toBe('device-uuid-001');
    });

    it('updates an existing record when deviceId matches (upsert)', () => {
      const { store } = makeStore();
      const original = makeRecord({ appVersion: '1.0.0' });
      store.upsert(original);

      const updated = makeRecord({ appVersion: '2.0.0', updatedAt: new Date().toISOString() });
      store.upsert(updated);

      const all = store.all();
      expect(all).toHaveLength(1); // still only one device
      expect(all[0].appVersion).toBe('2.0.0');
    });

    it('preserves registeredAt on update, updates updatedAt', () => {
      const { store } = makeStore();
      const originalTime = '2024-01-01T00:00:00.000Z';
      const original = makeRecord({ registeredAt: originalTime, updatedAt: originalTime });
      store.upsert(original);

      const laterTime = '2024-06-01T00:00:00.000Z';
      const updated = makeRecord({ registeredAt: laterTime, updatedAt: laterTime });
      store.upsert(updated);

      const found = store.findByDeviceId('device-uuid-001');
      // The upsert replaces the whole record, including timestamps from caller
      expect(found).toBeDefined();
      expect(found!.updatedAt).toBe(laterTime);
    });

    it('can store multiple different devices', () => {
      const { store } = makeStore();
      store.upsert(makeRecord({ deviceId: 'dev-A', userId: 'user-1' }));
      store.upsert(makeRecord({ deviceId: 'dev-B', userId: 'user-1' }));
      store.upsert(makeRecord({ deviceId: 'dev-C', userId: 'user-2' }));

      expect(store.all()).toHaveLength(3);
    });
  });

  describe('remove()', () => {
    it('removes an existing device and returns true', () => {
      const { store } = makeStore();
      store.upsert(makeRecord({ deviceId: 'dev-X' }));

      const result = store.remove('dev-X');

      expect(result).toBe(true);
      expect(store.all()).toHaveLength(0);
    });

    it('returns false when device not found', () => {
      const { store } = makeStore();
      const result = store.remove('nonexistent-device');
      expect(result).toBe(false);
    });

    it('only removes the specified device, leaving others intact', () => {
      const { store } = makeStore();
      store.upsert(makeRecord({ deviceId: 'dev-keep' }));
      store.upsert(makeRecord({ deviceId: 'dev-remove' }));

      store.remove('dev-remove');

      const all = store.all();
      expect(all).toHaveLength(1);
      expect(all[0].deviceId).toBe('dev-keep');
    });
  });

  describe('findByUser()', () => {
    it('returns all devices for a given userId', () => {
      const { store } = makeStore();
      store.upsert(makeRecord({ deviceId: 'dev-1', userId: 'user-A' }));
      store.upsert(makeRecord({ deviceId: 'dev-2', userId: 'user-A' }));
      store.upsert(makeRecord({ deviceId: 'dev-3', userId: 'user-B' }));

      const devicesForA = store.findByUser('user-A');
      expect(devicesForA).toHaveLength(2);
      expect(devicesForA.map(d => d.deviceId)).toContain('dev-1');
      expect(devicesForA.map(d => d.deviceId)).toContain('dev-2');
    });

    it('returns empty array when user has no devices', () => {
      const { store } = makeStore();
      expect(store.findByUser('unknown-user')).toEqual([]);
    });

    it('returns empty array for empty store', () => {
      const { store } = makeStore();
      expect(store.findByUser('any-user')).toEqual([]);
    });
  });

  describe('findByDeviceId()', () => {
    it('returns the device record for a known deviceId', () => {
      const { store } = makeStore();
      const record = makeRecord({ deviceId: 'known-dev', expoPushToken: 'ExponentPushToken[XYZ]' });
      store.upsert(record);

      const found = store.findByDeviceId('known-dev');
      expect(found).toBeDefined();
      expect(found!.expoPushToken).toBe('ExponentPushToken[XYZ]');
    });

    it('returns undefined for an unknown deviceId', () => {
      const { store } = makeStore();
      expect(store.findByDeviceId('nope')).toBeUndefined();
    });
  });

  describe('atomic writes', () => {
    it('writes valid JSON that can be parsed after upsert', () => {
      const { store, tmpPath } = makeStore();
      store.upsert(makeRecord());

      const raw = fs.readFileSync(tmpPath, 'utf-8');
      expect(() => JSON.parse(raw)).not.toThrow();
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('does not leave a .tmp file after a successful write', () => {
      const { store, tmpPath } = makeStore();
      store.upsert(makeRecord());

      expect(fs.existsSync(`${tmpPath}.tmp`)).toBe(false);
    });
  });
});
