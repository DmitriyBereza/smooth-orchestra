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
   * Check if a Cursor CLI binary is available on the system PATH.
   * We treat either the desktop-bundled `cursor` launcher or the standalone
   * `agent` CLI as satisfying availability.
   *
   * Result is cached; call refresh() to force a re-check.
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
  private static readonly CURSOR_MODEL_PREFIXES = ['cursor-', 'composer-'];

  /**
   * Returns true if the model value looks like a Cursor model.
   */
  static isCursorModel(value: string): boolean {
    return CursorDetector.CURSOR_MODEL_PREFIXES.some((prefix) => value.startsWith(prefix));
  }

  private detect(): Promise<boolean> {
    const home = process.env.HOME ?? '';
    const extraPaths = [
      `${home}/.local/bin`,
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ].join(':');
    const env = {
      ...process.env,
      PATH: `${extraPaths}:${process.env.PATH ?? ''}`,
    };

    return new Promise((resolve) => {
      execFile('cursor', ['--version'], { timeout: 5000, env }, (cursorErr) => {
        if (!cursorErr) {
          resolve(true);
          return;
        }

        execFile('agent', ['--version'], { timeout: 5000, env }, (agentErr) => {
          resolve(!agentErr);
        });
      });
    });
  }
}
