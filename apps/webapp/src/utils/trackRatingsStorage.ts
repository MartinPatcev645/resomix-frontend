export type TrackRatingsMap = Record<string, number>;

const LS_KEY = "resomix:trackRatings";

const isBrowser = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export function loadAllTrackRatings(): TrackRatingsMap {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as TrackRatingsMap) : {};
  } catch {
    return {};
  }
}

export function getTrackRating(trackId: string): number | undefined {
  const map = loadAllTrackRatings();
  return map[trackId];
}

export function saveTrackRating(trackId: string, rating: number): void {
  if (!isBrowser()) return;
  try {
    const map = loadAllTrackRatings();
    map[trackId] = rating;
    window.localStorage.setItem(LS_KEY, JSON.stringify(map));
  } catch {
    // no-op
  }
}