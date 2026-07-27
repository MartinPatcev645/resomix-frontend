/**
 * Deterministic routing for unified `?id=` deep links.
 *
 * Catalogue track ids are numeric (`track_id: number` in the API). Playlist ids are UUIDs.
 * Never infer intent from fetch errors — a transient playlist load failure must not chain-discover.
 */

export type UrlIdKind = "catalogue-track" | "playlist";

const PLAYLIST_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CATALOGUE_TRACK_ID_RE = /^\d+$/;

/** Classify a URL `?id=` value, or null when the shape is neither track nor playlist. */
export function classifyUrlId(id: string): UrlIdKind | null {
  if (CATALOGUE_TRACK_ID_RE.test(id)) return "catalogue-track";
  if (PLAYLIST_UUID_RE.test(id)) return "playlist";
  return null;
}

export function isCatalogueTrackId(id: string): boolean {
  return classifyUrlId(id) === "catalogue-track";
}

export function isPlaylistUuid(id: string): boolean {
  return classifyUrlId(id) === "playlist";
}
