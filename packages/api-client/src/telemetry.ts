import axiosInstance from "./utils";
import { API_CONFIG } from "./config";

// ─── Event Types ─────────────────────────────────────────────────────────────

/**
 * Atomic telemetry event representing a single user–track interaction.
 *
 * The four event types map directly to DSRF-compliant reporting:
 * - `stream_start`      → diagnostic only (detects bot-farms)
 * - `stream_complete`   → royalty-bearing stream (listened ≥ 30 s)
 * - `stream_skip`       → user moved on before 30 s
 * - `download_success`  → purchased lossless file delivered
 */
export interface TelemetryEvent {
  /** Unique per browser tab — from `cookieStorage.TAB_ID` */
  tab_id: string;
  /** Track identifier from the player store */
  track_id: string;
  /** Playlist that was active when the event occurred */
  playlist_id: string;
  /** Authenticated user UUID, or `null` for anonymous sessions */
  user_id: string | null;
  /** Discriminator for the type of interaction */
  event_type:
    | "stream_start"
    | "stream_complete"
    | "stream_skip"
    | "download_success";
  /**
   * UNIX timestamp (seconds, UTC) when the playback session that produced
   * this event was first started.
   */
  start_time: number;
  /**
   * Actual seconds of audio the user consumed.
   * - For `stream_start` and `download_success` this is always `0`.
   * - For `stream_complete` / `stream_skip` this is the accumulated
   *   listening time (pause/seek do NOT reset the accumulator).
   */
  duration_seconds: number;
  /**
   * UI context in which the stream originated.
   * Examples: `"search_results"`, `"playlist_view"`, `"direct_link"`.
   */
  context: string;
  /** UNIX timestamp (ms) when this event object was created on the client */
  client_ts: number;
}

/**
 * Payload shape sent to the backend in a single batch POST.
 */
export interface TelemetryBatch {
  events: TelemetryEvent[];
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Fire-and-forget POST of a batch of telemetry events.
 *
 * Uses the shared Axios instance (`withCredentials`, guest device hash). The telemetry endpoint
 * is public (guest beacons → System Partner 1); no api_key is sent. Returns true on 200 OK,
 * allowing the caller to safely clear the queue.
 */
export async function syncTelemetry(events: TelemetryEvent[]): Promise<boolean> {
  if (!events.length) return true;

  try {
    const payload: TelemetryBatch = { events };
    const res = await axiosInstance.post(API_CONFIG.ENDPOINTS.TELEMETRY_SYNC, payload);
    return res.status >= 200 && res.status < 300;
  } catch {
    // Intentionally swallowed.  Telemetry loss is acceptable;
    // user-experience degradation is not.
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[Telemetry] sync failed — batch of", events.length, "events dropped/retained");
    }
    return false;
  }
}

/**
 * Transmit a telemetry batch via `fetch` with `keepalive: true`.
 *
 * This is the last-resort flush used during `visibilitychange` / `pagehide`.
 * `keepalive` is physically guaranteed to enqueue the request even after the
 * user has closed the tab. Unlike `navigator.sendBeacon`, it natively
 * preserves `application/json` content type.
 */
export function beaconTelemetry(events: TelemetryEvent[]): void {
  if (!events.length) return;

  const payload: TelemetryBatch = { events };
  const baseUrl = API_CONFIG.BASE_URL ? API_CONFIG.BASE_URL.replace(/\/$/, "") : "";
  const endpoint = API_CONFIG.ENDPOINTS.TELEMETRY_SYNC;
  const url = `${baseUrl}${endpoint}`;  // public endpoint — no api_key

  if (typeof fetch !== "undefined") {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Ignore failures on unload
    });
  } else {
    // Beacon API not available — best-effort async POST.
    syncTelemetry(events);
  }
}
