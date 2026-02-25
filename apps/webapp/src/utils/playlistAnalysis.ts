/**
 * Persists per-playlist PYXIS-1 analysis stats in localStorage.
 * Keyed by playlist ID so multiple tabs never mix their results.
 */

export interface PlaylistAnalysisStats {
  /** Actual number of similar tracks returned */
  resultCount: number;
  /** Highest similarity score (0–1) in the results */
  topMatchScore: number;
  /**
   * Seconds the analysis took, or null when loaded from
   * cache / server (no timing data available).
   */
  analysisSeconds: number | null;
}

const LS_KEY = 'resomix:playlistAnalysis';
const MAX_ENTRIES = 10; // keep stats for up to 10 recent playlists

const isBrowser = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function loadMap(): Record<string, PlaylistAnalysisStats> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, PlaylistAnalysisStats>)
      : {};
  } catch {
    return {};
  }
}

function saveMap(map: Record<string, PlaylistAnalysisStats>): void {
  if (!isBrowser()) return;
  try {
    // Trim to MAX_ENTRIES (keep most recently inserted keys)
    const keys = Object.keys(map);
    if (keys.length > MAX_ENTRIES) {
      const trimmed: Record<string, PlaylistAnalysisStats> = {};
      keys.slice(-MAX_ENTRIES).forEach((k) => { trimmed[k] = map[k]; });
      window.localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    } else {
      window.localStorage.setItem(LS_KEY, JSON.stringify(map));
    }
  } catch {
    // Safari private mode / quota exceeded — silently ignore
  }
}

/** Persist analysis stats for a playlist. Overwrites any existing entry. */
export function savePlaylistAnalysis(
  playlistId: string,
  stats: PlaylistAnalysisStats,
): void {
  if (!playlistId) return;
  const map = loadMap();
  // Re-insert at the "end" so it is treated as most-recent for trimming
  delete map[playlistId];
  map[playlistId] = stats;
  saveMap(map);
}

/** Load analysis stats for a playlist, or null if not found. */
export function loadPlaylistAnalysis(
  playlistId: string,
): PlaylistAnalysisStats | null {
  if (!playlistId) return null;
  const map = loadMap();
  return map[playlistId] ?? null;
}
