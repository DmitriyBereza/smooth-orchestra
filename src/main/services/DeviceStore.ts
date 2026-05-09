import fs from 'fs';
import { DeviceRecord } from '../types/device';

/**
 * Synchronous, file-backed device store for mobile push token registration.
 *
 * Persists device records as a JSON array at the given file path.
 * Follows the exact same pattern as UserStore:
 * - All reads go directly to disk (no in-memory cache)
 * - Atomic writes via `.tmp` file + rename
 * - No external lock needed (Node.js single-thread guarantee)
 */
export class DeviceStore {
  constructor(private readonly filePath: string) {
    // Create the backing file with an empty array if it does not exist.
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]), 'utf-8');
    }
  }

  /**
   * Returns all stored device records, read fresh from disk.
   */
  all(): DeviceRecord[] {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as DeviceRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Finds all devices registered by a given user.
   */
  findByUser(userId: string): DeviceRecord[] {
    return this.all().filter((d) => d.userId === userId);
  }

  /**
   * Finds a single device by its stable per-install deviceId.
   */
  findByDeviceId(deviceId: string): DeviceRecord | undefined {
    return this.all().find((d) => d.deviceId === deviceId);
  }

  /**
   * Inserts or updates a device record (matched by deviceId).
   *
   * Uses an atomic write pattern: data is written to a `.tmp` file first,
   * then renamed over the real path. This prevents corrupt JSON if the
   * process is interrupted mid-write.
   */
  upsert(record: DeviceRecord): void {
    const records = this.all();
    const idx = records.findIndex((d) => d.deviceId === record.deviceId);
    if (idx >= 0) {
      records[idx] = record;
    } else {
      records.push(record);
    }

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  /**
   * Removes a device by deviceId.
   *
   * @returns true if the device was found and removed, false if not found.
   */
  remove(deviceId: string): boolean {
    const records = this.all();
    const idx = records.findIndex((d) => d.deviceId === deviceId);
    if (idx < 0) {
      return false;
    }

    records.splice(idx, 1);
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
    return true;
  }
}
