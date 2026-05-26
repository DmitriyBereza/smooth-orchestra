/**
 * CursorDetector — Checks whether the Cursor CLI binary is available on PATH.
 *
 * Used to disable Cursor model options in the UI when Cursor is not installed.
 * Results are cached; call refresh() to re-check.
 */
import { execFile } from 'child_process';

export class CursorDetector {
  private cachedResult: boolean | null = null;
  private pendingCheck: Promise<boolean> | null = null;

  /**
   * Check if the `cursor` binary is available on the system PATH.
   * Caches the result after the first check.
   */
  async isCursorAvailable(): Promise<boolean> {
    if (this.cachedResult !== null) {
      return this.cachedResult;
    }

    if (this.pendingCheck) {
      return this.pendingCheck;
    }

    this.pendingCheck = this.detect();
    const result = await this.pendingCheck;
    this.cachedResult = result;
    this.pendingCheck = null;
    return result;
  }

  /**
   * Clear the cached result so the next call to isCursorAvailable() re-checks.
   */
  refresh(): void {
    this.cachedResult = null;
    this.pendingCheck = null;
  }

  /**
   * Known Cursor model value prefixes. Used for server-side validation
   * without importing from src/shared (different tsconfig rootDir).
   */
  private static readonly CURSOR_MODEL_PREFIXES = ['composer-'];

  /**
   * Returns true if the model value looks like a Cursor model.
   */
  static isCursorModel(value: string): boolean {
    return CursorDetector.CURSOR_MODEL_PREFIXES.some((prefix) => value.startsWith(prefix));
  }

  private detect(): Promise<boolean> {
    return new Promise((resolve) => {
      execFile('cursor', ['--version'], { timeout: 5000 }, (err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}
