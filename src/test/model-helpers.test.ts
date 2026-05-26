import { describe, it, expect } from 'vitest';
import { MODEL_GROUPS, ALL_MODEL_OPTIONS, getModelLabel } from '../shared/model-helpers';

describe('model-helpers', () => {
  describe('MODEL_GROUPS', () => {
    it('has exactly 2 groups with providers Claude and Cursor', () => {
      expect(MODEL_GROUPS).toHaveLength(2);
      expect(MODEL_GROUPS.map((g) => g.provider)).toEqual(['Claude', 'Cursor']);
    });

    it('Claude group contains the 4 existing Claude models', () => {
      const claude = MODEL_GROUPS.find((g) => g.provider === 'Claude')!;
      expect(claude.options).toEqual([
        { value: 'claude-opus-4-7', label: 'Opus 4.7' },
        { value: 'claude-opus-4-6', label: 'Opus 4.6' },
        { value: 'claude-sonnet-4-6', label: 'Sonnet' },
        { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
      ]);
    });

    it('Cursor group contains auto and composer models', () => {
      const cursor = MODEL_GROUPS.find((g) => g.provider === 'Cursor')!;
      expect(cursor.options).toEqual([
        { value: 'cursor-auto', label: 'Auto' },
        { value: 'composer-2.5', label: 'Composer' },
      ]);
    });
  });

  describe('ALL_MODEL_OPTIONS', () => {
    it('has Default as the first option with empty value', () => {
      expect(ALL_MODEL_OPTIONS[0]).toEqual({ value: '', label: 'Default' });
    });

    it('includes all models from all groups plus Default', () => {
      const totalGroupOptions = MODEL_GROUPS.reduce((sum, g) => sum + g.options.length, 0);
      expect(ALL_MODEL_OPTIONS).toHaveLength(totalGroupOptions + 1); // +1 for Default
    });

    it('includes composer-2.5', () => {
      expect(ALL_MODEL_OPTIONS.find((o) => o.value === 'composer-2.5')).toEqual({
        value: 'composer-2.5',
        label: 'Composer',
      });
    });
  });

  describe('getModelLabel', () => {
    it('returns "Default" for empty string', () => {
      expect(getModelLabel('')).toBe('Default');
    });

    it('returns "Composer" for composer-2.5', () => {
      expect(getModelLabel('composer-2.5')).toBe('Composer');
    });

    it('returns "Opus 4.7" for claude-opus-4-7', () => {
      expect(getModelLabel('claude-opus-4-7')).toBe('Opus 4.7');
    });

    it('returns "Sonnet" for claude-sonnet-4-6', () => {
      expect(getModelLabel('claude-sonnet-4-6')).toBe('Sonnet');
    });

    it('returns the raw value as fallback for unknown models', () => {
      expect(getModelLabel('unknown-model')).toBe('unknown-model');
    });
  });
});
