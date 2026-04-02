import fs from 'fs';
import { UserRecord } from '../types/auth';

/**
 * Synchronous, file-backed user store.
 *
 * All reads go directly to disk — no in-memory cache — so the data
 * survives restarts and stays consistent across multiple code paths
 * within the same process.
 *
 * Concurrency note: Node.js is single-threaded. All operations here
 * are synchronous, so a read-modify-write cycle within a single call
 * stack cannot be interleaved with another caller. No external lock
 * is needed.
 */
export class UserStore {
  constructor(private filePath: string) {
    // Create the backing file with an empty array if it does not exist.
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify([]), 'utf-8');
    }
  }

  /**
   * Returns all stored user records, read fresh from disk.
   */
  all(): UserRecord[] {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as UserRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Finds a user by email address (case-insensitive).
   */
  findByEmail(email: string): UserRecord | undefined {
    const normalized = email.toLowerCase();
    return this.all().find((u) => u.email.toLowerCase() === normalized);
  }

  /**
   * Finds a user by their unique id.
   */
  findById(id: string): UserRecord | undefined {
    return this.all().find((u) => u.id === id);
  }

  /**
   * Persists a user record.
   * - If a user with the same `id` already exists it is replaced (upsert).
   * - If not, the user is appended.
   *
   * Uses an atomic write pattern: data is written to a `.tmp` file first,
   * then renamed over the real path. This prevents corrupt JSON if the
   * process is interrupted mid-write.
   *
   * Node.js single-thread guarantee: synchronous read-modify-write is
   * atomic within a single process. No external lock needed.
   */
  save(user: UserRecord): void {
    const users = this.all();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }

    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }
}
