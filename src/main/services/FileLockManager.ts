import fs from 'fs';
import path from 'path';
import { eventBus } from './EventBus';

interface LockEntry {
  holder: string;
  taskId: string;
  acquiredAt: string;
}

/**
 * Advisory file lock manager — prevents concurrent writes to the same file by different agents.
 * Locks are in-memory with optional persistence to .orchestra/locks/locks.json for crash recovery.
 */
export class FileLockManager {
  private locks = new Map<string, LockEntry>();
  private persistPath: string;

  constructor(private orchestraDir: string) {
    this.persistPath = path.join(orchestraDir, 'locks', 'locks.json');
    this.loadFromDisk();
  }

  acquire(filepath: string, holder: string, taskId: string): boolean {
    const normalized = path.resolve(filepath);
    const existing = this.locks.get(normalized);

    if (existing && existing.holder !== holder) {
      return false; // Already locked by another agent
    }

    const entry: LockEntry = {
      holder,
      taskId,
      acquiredAt: new Date().toISOString(),
    };

    this.locks.set(normalized, entry);
    this.persistToDisk();

    eventBus.emit('lock:acquired', { filepath: normalized, holder, taskId });
    return true;
  }

  release(filepath: string, holder: string): boolean {
    const normalized = path.resolve(filepath);
    const existing = this.locks.get(normalized);

    if (!existing || existing.holder !== holder) {
      return false;
    }

    this.locks.delete(normalized);
    this.persistToDisk();

    eventBus.emit('lock:released', { filepath: normalized, holder });
    return true;
  }

  releaseAll(holder: string): void {
    const toRelease: string[] = [];
    for (const [filepath, entry] of this.locks) {
      if (entry.holder === holder) {
        toRelease.push(filepath);
      }
    }
    for (const filepath of toRelease) {
      this.release(filepath, holder);
    }
  }

  /**
   * Releases all locks whose holder starts with the given prefix.
   * Useful for cleaning up all locks for a task (e.g., prefix `developer-TASK-001`
   * releases all developer subtask locks for that task).
   */
  releaseByPrefix(prefix: string): void {
    const toRelease: Array<{ filepath: string; holder: string }> = [];
    for (const [filepath, entry] of this.locks) {
      if (entry.holder.startsWith(prefix)) {
        toRelease.push({ filepath, holder: entry.holder });
      }
    }
    for (const { filepath, holder } of toRelease) {
      this.release(filepath, holder);
    }
  }

  isLocked(filepath: string): LockEntry | null {
    const normalized = path.resolve(filepath);
    return this.locks.get(normalized) || null;
  }

  forceRelease(filepath: string): void {
    const normalized = path.resolve(filepath);
    const existing = this.locks.get(normalized);
    if (existing) {
      this.locks.delete(normalized);
      this.persistToDisk();
      eventBus.emit('lock:released', { filepath: normalized, holder: existing.holder });
    }
  }

  getAllLocks(): Record<string, LockEntry> {
    const result: Record<string, LockEntry> = {};
    for (const [filepath, entry] of this.locks) {
      result[filepath] = entry;
    }
    return result;
  }

  private persistToDisk(): void {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistPath, JSON.stringify(this.getAllLocks(), null, 2));
    } catch {
      // Non-critical — locks are primarily in-memory
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
        for (const [filepath, entry] of Object.entries(data)) {
          this.locks.set(filepath, entry as LockEntry);
        }
      }
    } catch {
      // Start fresh if file is corrupted
    }
  }
}
