/**
 * CursorDetector unit tests
 *
 * TDD RED phase: tests written before implementation.
 * Covers AC1 (CLI detection logic) and AC8 (unit tests for detection).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll mock child_process.execFile to control CLI detection
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'child_process';
import { CursorDetector } from '../CursorDetector';

const mockExecFile = vi.mocked(execFile);

describe('CursorDetector', () => {
  describe('static isCursorModel()', () => {
    it('returns true for composer-2.5', () => {
      expect(CursorDetector.isCursorModel('composer-2.5')).toBe(true);
    });

    it('returns false for claude-opus-4-7', () => {
      expect(CursorDetector.isCursorModel('claude-opus-4-7')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(CursorDetector.isCursorModel('')).toBe(false);
    });
  });

  let detector: CursorDetector;

  beforeEach(() => {
    detector = new CursorDetector();
    vi.clearAllMocks();
  });

  describe('isCursorAvailable()', () => {
    it('returns true when cursor binary is found on PATH', async () => {
      // Simulate successful `cursor --version` execution
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        callback!(null, 'cursor 0.48.0', '');
        return {} as any;
      });

      const result = await detector.isCursorAvailable();
      expect(result).toBe(true);
    });

    it('returns false when cursor binary is not found', async () => {
      // Simulate ENOENT (binary not on PATH)
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        const err = new Error('spawn cursor ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        callback!(err, '', '');
        return {} as any;
      });

      const result = await detector.isCursorAvailable();
      expect(result).toBe(false);
    });

    it('returns false when cursor binary exits with non-zero code', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        const err = new Error('Command failed') as any;
        err.code = 1;
        callback!(err, '', 'error');
        return {} as any;
      });

      const result = await detector.isCursorAvailable();
      expect(result).toBe(false);
    });

    it('caches the result and does not re-execute on subsequent calls', async () => {
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        callback!(null, 'cursor 0.48.0', '');
        return {} as any;
      });

      await detector.isCursorAvailable();
      await detector.isCursorAvailable();

      // execFile should only have been called once due to caching
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it('refresh() clears cache and re-checks', async () => {
      // First call: cursor available
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        callback!(null, 'cursor 0.48.0', '');
        return {} as any;
      });

      expect(await detector.isCursorAvailable()).toBe(true);

      // Simulate cursor being removed
      mockExecFile.mockImplementation((_cmd, _args, _opts, cb) => {
        const callback = typeof _opts === 'function' ? _opts : cb;
        const err = new Error('ENOENT') as NodeJS.ErrnoException;
        err.code = 'ENOENT';
        callback!(err, '', '');
        return {} as any;
      });

      // Without refresh, should return cached true
      expect(await detector.isCursorAvailable()).toBe(true);

      // After refresh, should re-detect
      detector.refresh();
      expect(await detector.isCursorAvailable()).toBe(false);
      // With agent fallback, the final detect path may probe both `cursor` and `agent`.
      expect(mockExecFile).toHaveBeenCalledTimes(3);
    });
  });
});
