/**
 * Bandcamp integration client — the ONLY file that knows what the backend sends.
 * ================================================================================
 *
 * The browser never talks to Bandcamp: every call goes to the Resomix backend through the shared
 * `authClient`, which attaches the session and owns the 401 → refresh → "session expired" flow.
 * Raw response shapes (`Raw*` below) are converted to the app types in `./types.ts` by `mapItem`,
 * `mapSync` and `mapError`; if the contract changes, this file is the one that changes.
 */

import { authClient } from "@resomix/api-client";
import {
  BandcampApiError,
  type BandcampAnalysisStatus,
  type BandcampCollectionPage,
  type BandcampCollectionQuery,
  type BandcampConnectionState,
  type BandcampConnectionStatus,
  type BandcampErrorKind,
  type BandcampItem,
  type BandcampItemType,
  type BandcampSyncState,
  type BandcampSyncStatus,
} from "./types.ts";

export const BANDCAMP_BASE = "/api/v1/bandcamp";

interface RawConnectResponse {
  job_id?: string | number;
}

interface RawSyncResponse {
  status?: string;
  processed?: number | null;
  total?: number | null;
  error?: string | null;
}

export interface RawCollectionItem {
  id?: string | number;
  item_type?: string;
  artist?: string | null;
  title?: string | null;
  album?: string | null;
  artwork_url?: string | null;
  source_url?: string | null;
  resomix_track_id?: string | number | null;
  analysis_status?: string | null;
}

interface RawCollectionResponse {
  items?: RawCollectionItem[];
  total?: number;
  page?: number;
  page_size?: number;
}

interface RawConnectionResponse {
  connected?: boolean;
  username?: string | null;
  status?: string;
  last_synced_at?: string | null;
  active_job_id?: string | number | null;
  item_count?: number;
}

/** Tolerates the `{ success, data }` envelope most other Resomix endpoints use. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === "object" && "data" in body && "success" in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

const ANALYSIS_STATUSES: readonly BandcampAnalysisStatus[] = ["none", "queued", "done", "failed"];

/** The backend sends `queued | running | done | failed`; the brief's names are accepted too. */
const SYNC_STATUS_MAP: Record<string, BandcampSyncStatus> = {
  queued: "pending",
  pending: "pending",
  running: "syncing",
  syncing: "syncing",
  done: "ready",
  ready: "ready",
  failed: "failed",
};

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Only http(s) links leave the app; anything else is dropped rather than rendered as an href. */
function asHttpUrl(value: unknown): string | null {
  const text = asText(value);
  return text && /^https?:\/\//i.test(text) ? text : null;
}

export function mapItem(raw: RawCollectionItem): BandcampItem {
  const itemType: BandcampItemType = raw.item_type === "album" ? "album" : "track";
  const analysisStatus = ANALYSIS_STATUSES.includes(raw.analysis_status as BandcampAnalysisStatus)
    ? (raw.analysis_status as BandcampAnalysisStatus)
    : "none";
  const trackId = raw.resomix_track_id;
  return {
    id: String(raw.id ?? ""),
    itemType,
    artist: asText(raw.artist) ?? "Unknown artist",
    title: asText(raw.title) ?? "Untitled",
    album: asText(raw.album),
    artworkUrl: asHttpUrl(raw.artwork_url),
    sourceUrl: asHttpUrl(raw.source_url),
    resomixTrackId: trackId === null || trackId === undefined || trackId === "" ? null : String(trackId),
    analysisStatus,
  };
}

export function mapSync(raw: RawSyncResponse): BandcampSyncState {
  const status = SYNC_STATUS_MAP[String(raw.status ?? "").toLowerCase()] ?? "pending";
  const total = asNumber(raw.total, 0);
  return {
    status,
    processed: Math.max(0, asNumber(raw.processed, 0)),
    total: total > 0 ? total : null,
    error: asText(raw.error),
  };
}

const CONNECTION_STATUSES: readonly BandcampConnectionStatus[] = ["none", "pending", "syncing", "ready", "failed"];

export function mapConnection(raw: RawConnectionResponse): BandcampConnectionState {
  const connected = raw.connected === true;
  const status = String(raw.status ?? "").toLowerCase() as BandcampConnectionStatus;
  const jobId = raw.active_job_id;
  return {
    connected,
    username: connected ? asText(raw.username) : null,
    status: !connected ? "none" : CONNECTION_STATUSES.includes(status) ? status : "ready",
    lastSyncedAt: asText(raw.last_synced_at),
    activeJobId: connected && jobId !== null && jobId !== undefined && jobId !== "" ? String(jobId) : null,
    itemCount: Math.max(0, asNumber(raw.item_count, 0)),
  };
}

export function mapCollection(raw: RawCollectionResponse, query: BandcampCollectionQuery): BandcampCollectionPage {
  return {
    items: (raw.items ?? []).map(mapItem).filter((item) => item.id !== ""),
    total: Math.max(0, asNumber(raw.total, 0)),
    page: Math.max(1, asNumber(raw.page, query.page)),
    pageSize: Math.max(1, asNumber(raw.page_size, query.pageSize)),
  };
}

type RequestContext = "connection" | "connect" | "sync" | "collection" | "disconnect";

interface HttpLikeError {
  code?: string;
  name?: string;
  message?: string;
  response?: { status?: number; data?: unknown };
}

function serverMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const body = data as { error?: unknown; detail?: unknown; message?: unknown };
  for (const candidate of [body.error, body.detail, body.message]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function mapError(error: unknown, context: RequestContext): BandcampApiError {
  if (error instanceof BandcampApiError) return error;
  const err = (error ?? {}) as HttpLikeError;

  if (err.code === "ERR_CANCELED" || err.name === "CanceledError" || err.name === "AbortError") {
    return new BandcampApiError("aborted", "Request cancelled.");
  }

  const status = err.response?.status;
  if (status === undefined) {
    return new BandcampApiError("network", err.message || "Network error.");
  }

  const message = serverMessage(err.response?.data) ?? `Request failed (${status}).`;
  let kind: BandcampErrorKind = "unknown";
  if (status === 401) kind = "auth";
  else if (status === 403) kind = "private";
  else if (status === 404) kind = context === "connect" ? "not_found" : "not_connected";
  else if (status === 422) kind = "invalid";
  else if (status === 429) kind = "rate_limited";
  return new BandcampApiError(kind, message, status);
}

export async function getBandcampConnection(signal?: AbortSignal): Promise<BandcampConnectionState> {
  try {
    const res = await authClient.get(`${BANDCAMP_BASE}/connection`, { signal });
    return mapConnection(unwrap<RawConnectionResponse>(res.data) ?? {});
  } catch (error) {
    throw mapError(error, "connection");
  }
}

export async function connectBandcamp(username: string): Promise<{ jobId: string }> {
  try {
    const res = await authClient.post(`${BANDCAMP_BASE}/connect`, { username });
    const body = unwrap<RawConnectResponse>(res.data);
    if (body?.job_id === undefined || body.job_id === null || body.job_id === "") {
      throw new BandcampApiError("unknown", "The server did not return a sync job.");
    }
    return { jobId: String(body.job_id) };
  } catch (error) {
    throw mapError(error, "connect");
  }
}

export async function getBandcampSync(jobId: string, signal?: AbortSignal): Promise<BandcampSyncState> {
  try {
    const res = await authClient.get(`${BANDCAMP_BASE}/sync/${encodeURIComponent(jobId)}`, { signal });
    return mapSync(unwrap<RawSyncResponse>(res.data) ?? {});
  } catch (error) {
    throw mapError(error, "sync");
  }
}

export async function getBandcampCollection(
  query: BandcampCollectionQuery,
  signal?: AbortSignal,
): Promise<BandcampCollectionPage> {
  const params: Record<string, string | number> = { page: query.page, page_size: query.pageSize };
  const q = query.q?.trim();
  if (q) params.q = q;
  try {
    const res = await authClient.get(`${BANDCAMP_BASE}/collection`, { params, signal });
    return mapCollection(unwrap<RawCollectionResponse>(res.data) ?? {}, query);
  } catch (error) {
    throw mapError(error, "collection");
  }
}

export async function disconnectBandcamp(): Promise<void> {
  try {
    await authClient.delete(`${BANDCAMP_BASE}/connection`);
  } catch (error) {
    throw mapError(error, "disconnect");
  }
}
