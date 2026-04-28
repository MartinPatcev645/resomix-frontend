import { create } from "zustand";
import type { TelemetryEvent } from "@resomix/api-client";

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Minimum seconds of accumulated listening time before a session is classified
 * as `stream_complete` (royalty-bearing) vs `stream_skip`.
 */
export const STREAM_COMPLETE_THRESHOLD_SEC = 30;

// ─── Active Session ──────────────────────────────────────────────────────────

/**
 * Represents an in-progress listening session for a single track.
 *
 * The `accumulatedSeconds` field is the key metric: it tracks *actual* seconds
 * of audio consumed.  Pause/seek do NOT reset it — only the final outcome
 * (crossed 30 s or not) matters for DSRF reporting.
 */
export interface ActiveSession {
  trackId: string;
  playlistId: string;
  /** UNIX timestamp (seconds) when playback first started */
  startedAt: number;
  /**
   * Accumulated seconds of actual audio consumption.
   * Updated by the hook on every tick while `isPlaying === true`.
   */
  accumulatedSeconds: number;
  /** UI context where the stream originated */
  context: string;
  /**
   * Timestamp of the last accumulation tick (ms, `Date.now()`).
   * Used to compute the delta on the next tick.
   */
  lastTickMs: number;
  /**
   * Whether a `stream_complete` event has already been emitted for this
   * session.  Once true, crossing 30 s again (e.g. after a seek-back)
   * will not emit a second `stream_complete`.
   */
  completeFired: boolean;
}

// ─── Store Interface ─────────────────────────────────────────────────────────

export interface TelemetryStore {
  // ── Queue ──────────────────────────────────────────────────────────────────
  /** In-memory buffer of telemetry events awaiting flush */
  queue: TelemetryEvent[];
  /** Append a single event to the queue */
  enqueue: (event: TelemetryEvent) => void;
  /**
   * Atomically drain the queue: returns all buffered events and resets the
   * internal array to `[]`.  This guarantees that a concurrent `enqueue()`
   * call on another microtask won't lose data.
   */
  drainQueue: () => TelemetryEvent[];
  /**
   * Remove the oldest N events from the queue. Called after a successful sync.
   */
  removeEvents: (count: number) => void;

  // ── Active Session ─────────────────────────────────────────────────────────
  activeSession: ActiveSession | null;
  /**
   * Begin a new listening session.  If a previous session is still active
   * the caller is responsible for ending it first (the hook handles this).
   */
  startSession: (
    trackId: string,
    playlistId: string,
    context: string,
  ) => void;
  /**
   * Update accumulated listening seconds on the active session.
   * Called by the hook's `requestAnimationFrame` / `setInterval` tick.
   */
  tickSession: (nowMs: number) => void;
  /**
   * Mark the active session's `completeFired` flag as true.
   */
  markComplete: () => void;
  /**
   * Terminate the active session and clear it.
   * The caller (the hook) is responsible for enqueuing the final
   * `stream_complete` or `stream_skip` event before calling this.
   */
  clearSession: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useTelemetryStore = create<TelemetryStore>((set, get) => ({
  // ── Queue ──────────────────────────────────────────────────────────────────
  queue: [],

  enqueue: (event) =>
    set((state) => ({ queue: [...state.queue, event] })),

  drainQueue: () => {
    const current = get().queue;
    if (current.length === 0) return [];
    set({ queue: [] });
    return current;
  },

  removeEvents: (count) =>
    set((state) => ({ queue: state.queue.slice(count) })),

  // ── Active Session ─────────────────────────────────────────────────────────
  activeSession: null,

  startSession: (trackId, playlistId, context) =>
    set({
      activeSession: {
        trackId,
        playlistId,
        startedAt: Math.floor(Date.now() / 1000),
        accumulatedSeconds: 0,
        context,
        lastTickMs: Date.now(),
        completeFired: false,
      },
    }),

  tickSession: (nowMs) =>
    set((state) => {
      const session = state.activeSession;
      if (!session) return state;

      const deltaMs = Math.max(0, nowMs - session.lastTickMs);
      // Cap at 2 s to prevent huge jumps if the tab was suspended
      const deltaSec = Math.min(deltaMs / 1000, 2);

      return {
        activeSession: {
          ...session,
          accumulatedSeconds: session.accumulatedSeconds + deltaSec,
          lastTickMs: nowMs,
        },
      };
    }),

  markComplete: () =>
    set((state) => {
      const session = state.activeSession;
      if (!session) return state;
      return { activeSession: { ...session, completeFired: true } };
    }),

  clearSession: () => set({ activeSession: null }),
}));

export default useTelemetryStore;
