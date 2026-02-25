const EMPTY_LABEL_VALUES = new Set(['N/A', 'n/a', '']);

/**
 * Returns the label string if it is a meaningful value, otherwise undefined.
 * Handles blank strings and placeholder values like "N/A" returned by the backend.
 */
export function resolveLabel(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  if (EMPTY_LABEL_VALUES.has(label.trim())) return undefined;
  return label;
}
