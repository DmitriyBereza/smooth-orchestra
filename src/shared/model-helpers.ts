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
