import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Seeking the uploaded reference track on a playlist opened from the analysis
 * "Find similar tracks" CTA restarted playback instead of jumping.
 *
 * Two independent defects combined:
 *
 *  1. The controller snapshotted the playlist timeline the first time `load()` ran and never
 *     rebuilt it. On that route the store already holds the copy handed over when the sibling
 *     playlist was created, so the snapshot was taken from it — and the authoritative copy that
 *     the background revalidation swaps in moments later was ignored for the rest of the session.
 *  2. `seek()` clamped the target against that duration with `Math.min(..., d)`. A duration of 0
 *     means "not known yet", so every seek collapsed to the track's start offset.
 *
 * The creation copy could carry `duration: null` because the backend overwrote the DB-derived
 * value with a live measurement that is absent for an already-processed track (fixed separately in
 * similarity_service.py).
 */

// jsdom's HTMLMediaElement does not implement playback; a minimal stand-in keeps the assertions
// about `currentTime` deterministic and avoids "Not implemented" noise.
class FakeAudio {
  currentTime = 0;
  duration = NaN;
  paused = true;
  readyState = 0;
  volume = 1;
  preload = '';
  crossOrigin: string | null = null;
  src = '';
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();
}

const created: FakeAudio[] = [];
vi.stubGlobal(
  'Audio',
  vi.fn(() => {
    const a = new FakeAudio();
    created.push(a);
    return a;
  }),
);

vi.mock('hls.js', () => ({
  default: Object.assign(
    class {
      static isSupported: () => boolean = () => false;
      static Events: Record<string, string> = { LEVEL_LOADED: 'levelLoaded', MANIFEST_PARSED: 'manifestParsed', FRAG_LOADED: 'fragLoaded', ERROR: 'error' };
      static ErrorTypes: Record<string, string> = { MEDIA_ERROR: 'mediaError', NETWORK_ERROR: 'networkError' };
      static ErrorDetails: Record<string, string> = { MANIFEST_LOAD_ERROR: 'manifestLoadError', MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeout' };
      on = vi.fn();
      destroy = vi.fn();
      startLoad = vi.fn();
      loadSource = vi.fn();
      attachMedia = vi.fn();
    },
    {},
  ),
}));

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    getPlaylistPlaybackSession: vi.fn(() => Promise.resolve({ success: false })),
  };
});

const SEED_ID = 'seed-upload-uuid';
const PLAYLIST_ID = 'playlist-uuid';

/** The copy the app hands over at creation time — no measured duration for an already-processed upload. */
const creationPayload = {
  playlist: { id: PLAYLIST_ID, name: 'Similar to my upload' },
  queried_track: { id: SEED_ID, title: 'My upload', artist: 'Me', type: 'upload', duration: null },
  similar_tracks: [],
};

/** What `GET /playlists/similarity/{id}` returns — duration present, in seconds. */
const authoritativePayload = {
  ...creationPayload,
  queried_track: { ...creationPayload.queried_track, duration: 344 },
};

async function freshController() {
  vi.resetModules();
  created.length = 0;
  delete (globalThis as any).__RESOMIX_AUDIO_CONTROLLER__;
  // Not on the package barrel — import the module directly (relative, so tsc resolves it too).
  const { getOrCreateAudioController } = await import(
    '../../../../packages/hooks/src/Player/HlsPlaylistController.ts'
  );
  const { usePlaylistStore } = await import('@resomix/stores');
  return { controller: getOrCreateAudioController(), usePlaylistStore };
}

/** The HLS element is the first one the controller constructs. */
const hlsEl = () => created[0];

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('HLS seek against a revalidated playlist payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeks to the requested time after the payload is revalidated mid-session', async () => {
    const { controller, usePlaylistStore } = await freshController();

    // Arrive with the creation copy already in the store (the analysis route), and let the page's
    // mount auto-load run against it.
    usePlaylistStore.getState().setPlaylistData(creationPayload as any);
    controller.load(SEED_ID);
    await flush();

    // The background revalidation swaps in the authoritative copy.
    usePlaylistStore.getState().setPlaylistData(authoritativePayload as any);

    controller.seek(120, SEED_ID);

    // Before the fix this was 0 — the timeline was frozen on the creation copy, so the duration
    // was 0 and Math.min() clamped the offset to the start of the track.
    expect(hlsEl().currentTime).toBeCloseTo(120, 3);
  });

  /**
   * Discriminates the timeline rebuild specifically. The test above passes with EITHER fix (an
   * unclamped seek also lands on 120), so it cannot prove the rebuild happened. Clamping can only
   * be correct if the controller actually picked up the revalidated duration.
   */
  it('rebuilds the timeline, so the revalidated duration bounds the seek', async () => {
    const { controller, usePlaylistStore } = await freshController();

    usePlaylistStore.getState().setPlaylistData(creationPayload as any);
    controller.load(SEED_ID);
    await flush();

    usePlaylistStore.getState().setPlaylistData(authoritativePayload as any);

    controller.seek(10_000, SEED_ID);

    // Frozen on the creation copy the duration is 0, which no longer clamps — the seek would run
    // away to 10000. Only a rebuilt timeline knows the track is 344s long.
    expect(hlsEl().currentTime).toBeCloseTo(344, 3);
  });

  it('does not clamp a seek to zero when the duration is still unknown', async () => {
    const { controller, usePlaylistStore } = await freshController();

    // No revalidation at all — the duration never arrives. A seek must still move.
    usePlaylistStore.getState().setPlaylistData(creationPayload as any);
    controller.load(SEED_ID);
    await flush();

    controller.seek(90, SEED_ID);

    expect(hlsEl().currentTime).toBeCloseTo(90, 3);
  });

  it('still clamps to the track length once a real duration is known', async () => {
    const { controller, usePlaylistStore } = await freshController();

    usePlaylistStore.getState().setPlaylistData(authoritativePayload as any);
    controller.load(SEED_ID);
    await flush();

    controller.seek(10_000, SEED_ID);

    // 344s track — the clamp is still doing its job; only the "unknown" case is exempt.
    expect(hlsEl().currentTime).toBeCloseTo(344, 3);
  });

  it('keeps the store time in sync with the requested position', async () => {
    const { controller, usePlaylistStore } = await freshController();
    const { usePlayerStore } = await import('@resomix/stores');

    usePlaylistStore.getState().setPlaylistData(authoritativePayload as any);
    controller.load(SEED_ID);
    await flush();

    controller.seek(75, SEED_ID);

    expect(usePlayerStore.getState().trackTimes[SEED_ID]).toBeCloseTo(75, 3);
  });
});
