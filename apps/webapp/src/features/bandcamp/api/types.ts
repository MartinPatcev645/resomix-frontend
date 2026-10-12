/**
 * App-facing Bandcamp types. Components and hooks only ever see these; the raw backend shapes live
 * in `bandcampApi.ts` and are converted there.
 */

export type BandcampItemType = "album" | "track";

export interface BandcampItem {
  id: string;
  itemType: BandcampItemType;
  artist: string;
  title: string;
  album: string | null;
  artworkUrl: string | null;
  sourceUrl: string | null;
  /** Catalogue track id once the item has been matched into Resomix; null otherwise. */
  resomixTrackId: string | null;
}

export interface BandcampCollectionPage {
  items: BandcampItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BandcampCollectionQuery {
  page: number;
  pageSize: number;
  q?: string;
  /** When true, `GET /collection` is called with `matched=true`. */
  matched?: boolean;
}

export type BandcampSyncStatus = "pending" | "syncing" | "ready" | "failed";

export interface BandcampSyncState {
  status: BandcampSyncStatus;
  processed: number;
  /** Null while the backend does not know the collection size yet. */
  total: number | null;
  error: string | null;
}

export type BandcampConnectionStatus = "none" | "pending" | "syncing" | "ready" | "failed";

export interface BandcampConnectionState {
  connected: boolean;
  username: string | null;
  status: BandcampConnectionStatus;
  lastSyncedAt: string | null;
  /** The sync to resume polling, if one is queued or running. */
  activeJobId: string | null;
  itemCount: number;
  /** How many imported items are already in the Resomix catalogue. Null when the backend omits it. */
  matchedCount: number | null;
  /** Set when a sync stopped early but kept the rows it had already imported. */
  errorMessage: string | null;
}

export type BandcampErrorKind =
  | "not_found"
  | "private"
  | "invalid"
  | "rate_limited"
  | "not_connected"
  | "auth"
  | "network"
  | "aborted"
  | "unavailable"
  | "unknown";

export class BandcampApiError extends Error {
  readonly kind: BandcampErrorKind;
  readonly status?: number;

  constructor(kind: BandcampErrorKind, message: string, status?: number) {
    super(message);
    this.name = "BandcampApiError";
    this.kind = kind;
    this.status = status;
  }
}
