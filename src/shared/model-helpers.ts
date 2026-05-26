export interface ModelOption {
  value: string;
  label: string;
}

export interface ModelGroup {
  provider: string;
  options: ModelOption[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    provider: 'Claude',
    options: [
      { value: 'claude-opus-4-7', label: 'Opus 4.7' },
      { value: 'claude-opus-4-6', label: 'Opus 4.6' },
      { value: 'claude-sonnet-4-6', label: 'Sonnet' },
      { value: 'claude-haiku-4-5-20251001', label: 'Haiku' },
    ],
  },
  {
    provider: 'Cursor',
    options: [
      { value: 'cursor-auto', label: 'Auto' },
      { value: 'composer-2.5', label: 'Composer' },
    ],
  },
];

/** Flat list of all model options, with Default prepended. */
export const ALL_MODEL_OPTIONS: ModelOption[] = [
  { value: '', label: 'Default' },
  ...MODEL_GROUPS.flatMap((g) => g.options),
];

/** Returns display label for a model value. Falls back to raw value if unknown. */
export function getModelLabel(value: string): string {
  const found = ALL_MODEL_OPTIONS.find((o) => o.value === value);
  return found?.label ?? value;
}

/** Provider name for the Cursor group. */
export const CURSOR_PROVIDER = 'Cursor';

/** Returns all model values that belong to the Cursor provider group. */
export function getCursorModelValues(): string[] {
  const group = MODEL_GROUPS.find((g) => g.provider === CURSOR_PROVIDER);
  return group ? group.options.map((o) => o.value) : [];
}

/** Returns true if the given model value belongs to the Cursor provider. */
export function isCursorModel(value: string): boolean {
  if (!value) return false;
  return getCursorModelValues().includes(value);
}

/**
 * Validates that no Cursor models are selected when Cursor CLI is not available.
 * Returns an error message string if invalid, or null if OK.
 */
export function validateModelsForCursor(
  models: Record<string, string> | undefined,
  cursorAvailable: boolean,
): string | null {
  if (!models || cursorAvailable) return null;

  const cursorRoles = Object.entries(models)
    .filter(([, value]) => isCursorModel(value))
    .map(([role]) => role);

  if (cursorRoles.length === 0) return null;

  return `Cursor CLI is not installed. Cannot use Cursor models (${cursorRoles.join(', ')}). Please select a different model or install Cursor.`;
}
