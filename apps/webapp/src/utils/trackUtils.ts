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

/**
 * Display-safe text for the always-present metadata fields (title, artist).
 *
 * The backend's own "Unknown"/"N/A" placeholder can still be bypassed — e.g. an empty contributor
 * name overwrites it — so a track can arrive with "" or a whitespace-only value. Render "N/A"
 * rather than a blank cell.
 *
 * NB: do NOT use this for label/genre/album — those are legitimately optional and stay empty.
 */
export function displayOrNA(value: string | null | undefined): string {
  if (!value || !value.trim()) return 'N/A';
  return value;
}

/**
 * Returns the primary genre for display.
 *
 * The backend sends the Apple Music genre verbatim as a pipe list ("House | Afro"); the in-house
 * fallback is a single name. The table column and the player row are both tight, so we show only
 * the first entry ("House"). Change this one function to show the full list instead.
 */
export function firstGenre(genre: string | null | undefined): string | undefined {
  if (!genre) return undefined;
  const first = genre.split('|')[0].trim();
  if (!first || EMPTY_LABEL_VALUES.has(first)) return undefined;
  return first;
}
