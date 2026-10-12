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

const UNKNOWN_ARTIST_VALUES = new Set(['unknown', 'n/a', 'na', '']);

/** True when an artist/name string is a backend placeholder — omit rather than render literally. */
export function isUnknownArtist(value: string | null | undefined): boolean {
  if (!value) return true;
  return UNKNOWN_ARTIST_VALUES.has(value.trim().toLowerCase());
}

export function displayArtistOrOmit(value: string | null | undefined): string | undefined {
  if (isUnknownArtist(value)) return undefined;
  return value!.trim();
}

/** Strip backend " · UNKNOWN" suffix from combined title lines. */
export function sanitizeWorkspaceTitle(title: string): string {
  return title.replace(/\s*·\s*unknown\s*$/i, "").trim() || title;
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

export type BuyStore = 'traxsource' | 'bandcamp';

export interface BuyLink {
  store: BuyStore;
  label: string;
  url: string;
}

/**
 * The download stores a track can be bought from, in display order, only those with a link.
 * Catalogue tracks only: uploads never carry store links, and hidden tracks arrive with them nulled.
 */
export function buyLinksFor(track: {
  type?: string;
  traxsource_url?: string | null;
  bandcamp_url?: string | null;
}): BuyLink[] {
  if (track.type !== 'internal') return [];
  const links: BuyLink[] = [];
  if (track.traxsource_url) links.push({ store: 'traxsource', label: 'Traxsource', url: track.traxsource_url });
  if (track.bandcamp_url) links.push({ store: 'bandcamp', label: 'Bandcamp', url: track.bandcamp_url });
  return links;
}

/** Where a store link was shown, for the `store_link_clicked` analytics event. */
export interface StoreLinkTracking {
  surface: 'row' | 'sticky' | 'hero';
  trackId?: string | null;
}
