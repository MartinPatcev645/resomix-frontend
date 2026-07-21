/**
 * Library track meta display helpers
 * ==================================
 *
 * Pure display logic for the Library's labelled key/value meta pairs — kept here (not in the
 * page .tsx) per the repo convention: functionality lives in hooks/utils, components render.
 *
 * The pairs come out in FIXED order — absent fields are skipped entirely (their label too),
 * never rendered as "N/A"; the remaining pairs keep their relative order. Genre/BPM/Key prefer
 * the analysis-derived values (upload file tags never carry bpm/key, and the analysis genre is
 * the trustworthy one).
 */

import type { LibraryTrack, LibraryTrackAnalysis } from "@resomix/stores";

/** Display-worthy value or undefined — skips empty and placeholder values ("Unknown", "N/A"). */
export function cleanMeta(v?: string | null): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (!t || /^(unknown|n\/a)$/i.test(t)) return undefined;
  return t;
}

/** Upload timestamp for display: time (HH:MM) when it's today, otherwise the date. */
export function formatUploadDate(iso?: string | null): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

/** Compact musical key from the analysis, e.g. "Am (8A)" — key + minor suffix + camelot. */
export function keyDisplay(a?: LibraryTrackAnalysis | null): string | undefined {
  if (!a?.music_key) return undefined;
  const minor = a.scale ? a.scale.toLowerCase().startsWith("min") : false;
  const key = `${a.music_key}${minor ? "m" : ""}`;
  return a.camelot ? `${key} (${a.camelot})` : key;
}

/** The card's meta pairs: Artist · Uploaded · Genre · BPM · Key · Album · Label. */
export function trackMetaPairs(track: LibraryTrack): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const artist = cleanMeta(track.artist);
  if (artist) pairs.push(["Artist", artist]);
  const uploaded = formatUploadDate(track.created_at);
  if (uploaded) pairs.push(["Uploaded", uploaded]);
  const genre = cleanMeta(track.analysis?.top_genre) ?? cleanMeta(track.genre);
  if (genre) pairs.push(["Genre", genre]);
  if (track.analysis?.bpm) pairs.push(["BPM", String(Math.round(track.analysis.bpm))]);
  const key = keyDisplay(track.analysis);
  if (key) pairs.push(["Key", key]);
  const album = cleanMeta(track.album);
  if (album) pairs.push(["Album", album]);
  const label = cleanMeta(track.label);
  if (label) pairs.push(["Label", label]);
  return pairs;
}
