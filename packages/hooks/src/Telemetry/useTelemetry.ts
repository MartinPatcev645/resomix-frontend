import { useEffect, useRef } from "react";
import {
  usePlayerStore,
  usePlaylistStore,
  useAuthStore,
  useTelemetryStore,
  STREAM_COMPLETE_THRESHOLD_SEC,
  TAB_ID,
} from "@resomix/stores";
import {
  syncTelemetry,
  beaconTelemetry,
  type TelemetryEvent,
} from "@resomix/api-client";

// ─── Configuration ───────────────────────────────────────────────────────────

/**
 * Heartbeat interval (ms).  Configurable via the `VITE_TELEMETRY_HEARTBEAT_MS`
 * env var.  Defaults to 30 000 ms (30 s).
 */
const HEARTBEAT_MS: number = (() => {
  try {
    const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
    const raw = env?.VITE_TELEMETRY_HEARTBEAT_MS;
    if (raw) {
      const parsed = parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed >= 5000) return parsed;
    }
  } catch {
    /* env not available — use default */
  }
  return 30_000;
})();

/**
 * Interval (ms) for the accumulation tick that tracks how many seconds the
 * user has actually listened.  1 s is plenty accurate for DSRF.
 */
const TICK_INTERVAL_MS = 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive the UI context string from the current browser URL.
 * This gives us a rough idea of *where* the user triggered a stream.
 */
function deriveContext(): string {
  if (typeof window === "undefined") return "unknown";
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  if (path.includes("/playlist") || path.includes("/sonic-discovery")) {
    return "playlist_view";
  }
  if (params.has("q") || params.has("search")) {
    return "search_results";
  }
  if (path === "/" || path === "") {
    return "upload_page";
  }
  return "direct_link";
}

/**
 * Build a `TelemetryEvent` from the current application state.
 */
function createEvent(
  eventType: TelemetryEvent["event_type"],
  trackId: string,
  playlistId: string,
  startTime: number,
  durationSeconds: number,
  context: string,
): TelemetryEvent {
  const user = useAuthStore.getState().user;

  return {
    tab_id: TAB_ID,
    track_id: trackId,
    playlist_id: playlistId,
    user_id: user?.uuid ?? null,
    event_type: eventType,
    start_time: startTime,
    duration_seconds: Math.round(durationSeconds),
    context,
    client_ts: Date.now(),
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Top-level telemetry orchestration hook.
 *
 * Mount **once** at the `<App>` level.  It self-manages:
 * 1. Subscribing to player state changes (play/pause/track-switch).
 * 2. Accumulating listening seconds via a 1 s tick.
 * 3. Flushing the event queue every 30 s (heartbeat).
 * 4. Flushing via `sendBeacon` on `visibilitychange` / `pagehide`.
 *
 * No props, no context, no render output — purely side-effect driven.
 */
export function useTelemetry(): void {
  // Refs survive across re-renders and let us avoid stale-closure issues
  // in the non-React subscription callbacks.
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Guard against StrictMode double-mount
    if (mountedRef.current) return;
    mountedRef.current = true;

    const store = useTelemetryStore.getState;

    // ── 1. Accumulation Tick ───────────────────────────────────────────────
    // While a session is active AND the player is playing, tick every second
    // to accumulate `accumulatedSeconds`.  When the 30 s threshold is crossed
    // for the first time, enqueue a `stream_complete` event.

    tickTimerRef.current = setInterval(() => {
      const { activeSession } = store();
      const { isPlaying } = usePlayerStore.getState();

      if (!activeSession || !isPlaying) return;

      const now = Date.now();
      useTelemetryStore.getState().tickSession(now);

      // Re-read after tick to get updated accumulatedSeconds
      const updated = useTelemetryStore.getState().activeSession;
      if (!updated) return;

      // Emit stream_complete the first time we cross the threshold
      if (
        updated.accumulatedSeconds >= STREAM_COMPLETE_THRESHOLD_SEC &&
        !updated.completeFired
      ) {
        useTelemetryStore.getState().markComplete();
        useTelemetryStore.getState().enqueue(
          createEvent(
            "stream_complete",
            updated.trackId,
            updated.playlistId,
            updated.startedAt,
            updated.accumulatedSeconds,
            updated.context,
          ),
        );
      }
    }, TICK_INTERVAL_MS);

    // ── 2. Player State Subscription ───────────────────────────────────────
    // React to `isPlaying` and `currentTrackId` changes.
    // This is a Zustand non-React subscription — it runs outside of the
    // React render cycle.

    let prevIsPlaying = usePlayerStore.getState().isPlaying;
    let prevTrackId = usePlayerStore.getState().currentTrackId;

    const unsubPlayer = usePlayerStore.subscribe((state) => {
      const { isPlaying, currentTrackId: trackId } = state;
      const session = useTelemetryStore.getState().activeSession;
      const playlistData = usePlaylistStore.getState().playlistData;
      const playlistId = playlistData?.playlist?.id ?? "unknown";

      // ─ Case A: playback started (was paused, now playing) ─────────────
      if (isPlaying && !prevIsPlaying) {
        // If we're resuming the same track after a pause, just reset the
        // tick baseline so accumulated seconds continue from where they were.
        if (session && trackId && session.trackId === trackId) {
          useTelemetryStore.setState((s) => ({
            activeSession: s.activeSession
              ? { ...s.activeSession, lastTickMs: Date.now() }
              : null,
          }));
        } else if (trackId) {
          // New track — start a fresh session
          const ctx = deriveContext();
          useTelemetryStore.getState().startSession(trackId, playlistId, ctx);

          // Emit stream_start
          useTelemetryStore.getState().enqueue(
            createEvent(
              "stream_start",
              trackId,
              playlistId,
              Math.floor(Date.now() / 1000),
              0,
              ctx,
            ),
          );
        }
      }

      // ─ Case B: playback stopped (was playing, now paused) ─────────────
      // Note: we do NOT emit on pause.  The session stays alive.  Only when
      // the track *changes* (Case C) or the tab *unloads* do we finalize.
      // This matches the spec: "Nothing fires on pause/unpause."

      // ─ Case C: track changed while playing ────────────────────────────
      if (isPlaying && trackId && trackId !== prevTrackId && prevTrackId) {
        // Finalize the previous session
        if (session && session.trackId === prevTrackId) {
          finalizeSession(session);
        }

        // Start a new session for the new track
        const ctx = deriveContext();
        useTelemetryStore.getState().startSession(trackId, playlistId, ctx);

        useTelemetryStore.getState().enqueue(
          createEvent(
            "stream_start",
            trackId,
            playlistId,
            Math.floor(Date.now() / 1000),
            0,
            ctx,
          ),
        );
      }

      // ─ Case D: track changed while paused ─────────────────────────────
      // The user picked a new track but hasn't pressed play yet.
      // Finalize the old session if one exists.
      if (!isPlaying && trackId !== prevTrackId && prevTrackId && session) {
        if (session.trackId === prevTrackId) {
          finalizeSession(session);
        }
      }

      prevIsPlaying = isPlaying;
      prevTrackId = trackId;
    });

    // ── 3. Heartbeat Flush ─────────────────────────────────────────────────
    heartbeatTimerRef.current = setInterval(() => {
      const events = useTelemetryStore.getState().drainQueue();
      if (events.length > 0) {
        syncTelemetry(events);
      }
    }, HEARTBEAT_MS);

    // ── 4. Unload / Visibility Hooks ───────────────────────────────────────
    const onUnload = () => {
      // Finalize any active session so we don't lose the last events
      const session = useTelemetryStore.getState().activeSession;
      if (session) {
        finalizeSession(session);
      }

      const events = useTelemetryStore.getState().drainQueue();
      if (events.length > 0) {
        beaconTelemetry(events);
      }
    };

    // `pagehide` is the most reliable unload event across browsers.
    // `visibilitychange` catches tab-switch on mobile where `pagehide`
    // may not fire.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onUnload();
      }
    };

    window.addEventListener("pagehide", onUnload);
    document.addEventListener("visibilitychange", onVisibilityChange);

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      mountedRef.current = false;

      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      unsubPlayer();

      window.removeEventListener("pagehide", onUnload);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

// ─── Internals ───────────────────────────────────────────────────────────────

/**
 * End an active session by emitting the appropriate event
 * (`stream_skip` or `stream_complete`) and clearing the session from the store.
 *
 * If `stream_complete` was already emitted during the session (the 30 s
 * threshold was crossed while playing), we emit a *second* `stream_complete`
 * with the final accumulated duration.  This lets the backend see the full
 * picture.  If you only want one event per session, the backend can
 * deduplicate on `(tab_id, track_id, start_time)`.
 */
function finalizeSession(session: NonNullable<ReturnType<typeof useTelemetryStore.getState>["activeSession"]>): void {
  const eventType: TelemetryEvent["event_type"] =
    session.accumulatedSeconds >= STREAM_COMPLETE_THRESHOLD_SEC
      ? "stream_complete"
      : "stream_skip";

  // Only emit a finalization event if we haven't already fired a
  // stream_complete for this exact session, OR if the event type is
  // stream_skip (which is always the terminal event for short listens).
  if (!session.completeFired || eventType === "stream_skip") {
    useTelemetryStore.getState().enqueue(
      createEvent(
        eventType,
        session.trackId,
        session.playlistId,
        session.startedAt,
        session.accumulatedSeconds,
        session.context,
      ),
    );
  }

  useTelemetryStore.getState().clearSession();
}
