import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Playback died outright when a play click landed while the HLS stream was still being set up.
 *
 * `ensureHlsLoaded()` guarded on `isPlaylistLoaded`, but that flag is only set at the very END of
 * the method — after awaiting the playback session. Two callers arriving inside that window both
 * ran the whole attach: on a browser that means two `Hls` instances attached to the same `<audio>`,
 * where the second `attachMedia()` aborts the first instance's in-flight fragment request (the
 * cancelled segment request seen in the network panel) and orphans it. After that no segments are
 * ever requested again, while the waveform still renders and seeking still moves `currentTime` — so
 * it presents as a dead stream rather than an error.
 *
 * `load()` produces two calls in a single tick on its own (initPlaylist → ensureHlsLoaded, then
 * load's own), so this was never limited to user input; a slow network just widened the window.
 *
 * NOTE ON WHAT THIS EXERCISES: `hls.js` is a dependency of `packages/hooks`, not of this app, so a
 * `vi.mock('hls.js')` here binds to a different module id than the controller resolves and does
 * nothing. The real `Hls.isSupported()` is false under jsdom (no MediaSource), so the controller
 * takes its native-HLS branch and assigns `audio.src`. That is the same guarded region, so counting
 * src assignments measures exactly the property under test: the attach body runs at most once.
 */

/** Records src assignments so a duplicated attach is observable. */
class FakeAudio {
  currentTime = 0;
  duration = NaN;
  paused = true;
  readyState = 0;
  volume = 1;
  preload = '';
  crossOrigin: string | null = null;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  removeAttribute = vi.fn();
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  load = vi.fn();

  private _src = '';
  srcAssignments: string[] = [];
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value) this.srcAssignments.push(value);
  }
}

const audios: FakeAudio[] = [];
vi.stubGlobal(
  'Audio',
  vi.fn(() => {
    const a = new FakeAudio();
    audios.push(a);
    return a;
  }),
);

/** Resolves only when the test releases it, standing in for a slow playback-session request. */
let releaseSession: (() => void) | null = null;
const sessionCalls = { count: 0 };

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    getPlaylistPlaybackSession: vi.fn(() => {
      sessionCalls.count += 1;
      return new Promise((resolve) => {
        releaseSession = () =>
          resolve({ playback_url: 'https://media.example/p.m3u8?token=t' } as never);
      });
    }),
  };
});

const SEED_ID = 'seed-upload-uuid';

const playlist = {
  playlist: { id: 'playlist-uuid', name: 'Similar to my upload' },
  queried_track: { id: SEED_ID, title: 'My upload', artist: 'Me', type: 'upload', duration: 344 },
  similar_tracks: [],
};

async function freshController() {
  vi.resetModules();
  audios.length = 0;
  sessionCalls.count = 0;
  releaseSession = null;
  delete (globalThis as never as Record<string, unknown>).__RESOMIX_AUDIO_CONTROLLER__;
  const { getOrCreateAudioController } = await import(
    '../../../../packages/hooks/src/Player/HlsPlaylistController.ts'
  );
  const { usePlaylistStore } = await import('@resomix/stores');
  usePlaylistStore.getState().setPlaylistData(playlist as never);
  return getOrCreateAudioController();
}

/** The HLS element is the first one the controller constructs. */
const hlsEl = () => audios[0];

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HLS attach is serialised', () => {
  it('attaches once when a play click lands mid-setup', async () => {
    const controller = await freshController();

    // Mount auto-load: starts the attach, then blocks on the playback session.
    controller.load(SEED_ID);
    await tick();

    // The user presses play while the loader is still showing.
    controller.load(SEED_ID, true);
    await tick();

    releaseSession?.();
    await tick();
    await tick();

    // Before the fix the attach body ran twice — in a real browser that is two engines on one
    // element, and the later attach kills the earlier one's segment fetching for good.
    expect(hlsEl().srcAssignments).toHaveLength(1);
  });

  it('does not attach at all when unloaded mid-setup', async () => {
    const controller = await freshController();

    controller.load(SEED_ID);
    await tick();

    // Navigating away while the session request is still outstanding.
    controller.unload();
    releaseSession?.();
    await tick();
    await tick();

    // The attach must abandon itself rather than leave a live stream on a torn-down controller.
    expect(hlsEl().srcAssignments).toHaveLength(0);
  });

  it('survives a burst of rapid play presses', async () => {
    const controller = await freshController();

    for (let i = 0; i < 5; i++) controller.load(SEED_ID, true);
    await tick();
    releaseSession?.();
    await tick();
    await tick();

    expect(hlsEl().srcAssignments).toHaveLength(1);
    expect(sessionCalls.count).toBe(1);
  });
});
