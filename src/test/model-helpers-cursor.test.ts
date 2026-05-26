/**
 * Tests for cursor-related model helper functions.
 *
 * TDD RED phase: tests for isCursorModel() and validateModelsForCursor().
 * Covers AC6 (submission validation) and AC8 (unit tests).
 */
import { describe, it, expect } from 'vitest';
import {
  isCursorModel,
  getCursorModelValues,
  validateModelsForCursor,
} from '../shared/model-helpers';

describe('isCursorModel()', () => {
  it('returns true for composer-2.5', () => {
    expect(isCursorModel('composer-2.5')).toBe(true);
  });

  it('returns false for claude-opus-4-7', () => {
    expect(isCursorModel('claude-opus-4-7')).toBe(false);
  });

  it('returns false for empty string (Default)', () => {
    expect(isCursorModel('')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCursorModel(undefined as any)).toBe(false);
  });
});

describe('getCursorModelValues()', () => {
  it('returns an array containing composer-2.5', () => {
    const values = getCursorModelValues();
    expect(values).toContain('composer-2.5');
  });

  it('does not contain any Claude models', () => {
    const values = getCursorModelValues();
    expect(values.every((v) => !v.startsWith('claude-'))).toBe(true);
  });
});

describe('validateModelsForCursor()', () => {
  it('returns null (no error) when no cursor models are selected', () => {
    const models = { developer: 'claude-opus-4-7', qa: 'claude-sonnet-4-6' };
    expect(validateModelsForCursor(models, false)).toBeNull();
  });

  it('returns null when cursor models are selected and cursor IS available', () => {
    const models = { developer: 'composer-2.5' };
    expect(validateModelsForCursor(models, true)).toBeNull();
  });

  it('returns error message when cursor model selected but cursor NOT available', () => {
    const models = { developer: 'composer-2.5' };
    const result = validateModelsForCursor(models, false);
    expect(result).toBeTruthy();
    expect(result).toContain('Cursor');
  });

  it('returns error when any role has a cursor model and cursor not available', () => {
    const models = {
      developer: 'claude-opus-4-7',
      qa: 'composer-2.5',
    };
    const result = validateModelsForCursor(models, false);
    expect(result).toBeTruthy();
  });

  it('returns null for empty models object', () => {
    expect(validateModelsForCursor({}, false)).toBeNull();
  });

  it('returns null for undefined models', () => {
    expect(validateModelsForCursor(undefined, false)).toBeNull();
  });
});
