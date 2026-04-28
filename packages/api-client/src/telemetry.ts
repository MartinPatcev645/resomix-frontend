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
 * Uses the shared Axios instance (which already appends `api_key` and
 * `withCredentials`). Errors are silently swallowed — telemetry must never
 * block or degrade the user experience.
 */
export async function syncTelemetry(events: TelemetryEvent[]): Promise<void> {
  if (!events.length) return;

  try {
    const payload: TelemetryBatch = { events };
    await axiosInstance.post(API_CONFIG.ENDPOINTS.TELEMETRY_SYNC, payload);
  } catch {
    // Intentionally swallowed.  Telemetry loss is acceptable;
    // user-experience degradation is not.
    if (typeof console !== "undefined") {
      // eslint-disable-next-line no-console
      console.debug("[Telemetry] sync failed — batch of", events.length, "events dropped");
    }
  }
}

/**
 * Transmit a telemetry batch via `navigator.sendBeacon`.
 *
 * This is the last-resort flush used during `visibilitychange` / `pagehide`.
 * `sendBeacon` is physically guaranteed to enqueue the request even after the
 * user has closed the tab, unlike a normal `fetch` or XHR which the browser
 * may cancel.
 *
 * Falls back to a synchronous `syncTelemetry` call if the Beacon API is
 * unavailable (very old browsers).
 */
export function beaconTelemetry(events: TelemetryEvent[]): void {
  if (!events.length) return;

  const payload: TelemetryBatch = { events };
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TELEMETRY_SYNC}?api_key=${encodeURIComponent(API_CONFIG.API_KEY)}`;

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const queued = navigator.sendBeacon(url, blob);

      if (!queued) {
        // Browser rejected the beacon (payload too large or quota hit).
        // Fall back to async POST — it may or may not complete before unload.
        syncTelemetry(events);
      }
    } catch {
      syncTelemetry(events);
    }
  } else {
    // Beacon API not available — best-effort async POST.
    syncTelemetry(events);
  }
}
