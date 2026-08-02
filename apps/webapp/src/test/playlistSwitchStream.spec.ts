import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Opening a second playlist played the FIRST playlist's audio.
 *
 * `isPlaylistLoaded` was a bare boolean — "some playlist is attached", not "THIS playlist is
 * attached" — and the only thing that ever cleared it was `unload()`, which runs solely when the
 * AudioProvider unmounts. So playback correctness depended on a React unmount happening: any
 * playlist→playlist move that kept the route (chain-discover, back/forward, an in-app link between
 * playlists) left the previous manifest attached and streaming, while the hero, timeline and track
 * list all correctly showed the new playlist. Right metadata, wrong audio.
 *
 * The stream now records which playlist it belongs to, so it rebinds on any change of playlist,
 * regardless of how the user got there.
 */

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
  srcs: string[] = [];
  get src() {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    if (value) this.srcs.push(value);
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

/** Playlist ids the controller asked the server for a playback session for, in order. */
const sessionFor: string[] = [];
let sessionDelay: Promise<void> | null = null;

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    getPlaylistPlaybackSession: vi.fn(async (id: string) => {
      sessionFor.push(id);
      if (sessionDelay) await sessionDelay;
      return { playback_url: `https://media.example/${id}.m3u8?token=t` } as never;
    }),
  };
});

/** jsdom has no MediaSource, so the controller takes its native-HLS branch and assigns audio.src. */
const uploadPlaylist = (playlistId: string, trackId: string) => ({
  playlist: { id: playlistId, name: playlistId },
  queried_track: { id: trackId, title: trackId, artist: 'a', type: 'upload', duration: 300 },
  similar_tracks: [],
});

async function freshController() {
  vi.resetModules();
  audios.length = 0;
  sessionFor.length = 0;
  sessionDelay = null;
  delete (globalThis as never as Record<string, unknown>).__RESOMIX_AUDIO_CONTROLLER__;
  const { getOrCreateAudioController } = await import(
    '../../../../packages/hooks/src/Player/HlsPlaylistController.ts'
  );
  const { usePlaylistStore } = await import('@resomix/stores');
  return { controller: getOrCreateAudioController(), usePlaylistStore };
}

const hlsEl = () => audios[0];
const currentStream = () => hlsEl().srcs[hlsEl().srcs.length - 1] ?? '';
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('switching playlists rebinds the stream', () => {
  it('binds to the new playlist when the route never changes', async () => {
    const { controller, usePlaylistStore } = await freshController();

    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-X', 'TRK-X') as never);
    controller.load('TRK-X', true);
    await tick();
    await tick();
    expect(currentStream()).toContain('PL-X');

    // No unload — only the ?id= changed, so the provider stayed mounted.
    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-Y', 'TRK-Y') as never);
    controller.load('TRK-Y', true);
    await tick();
    await tick();

    // Before the fix: still PL-X, and pressing play gave you the previous playlist's track.
    expect(sessionFor).toContain('PL-Y');
    expect(currentStream()).toContain('PL-Y');
  });

  it('still works when the provider does unmount in between', async () => {
    const { controller, usePlaylistStore } = await freshController();

    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-X', 'TRK-X') as never);
    controller.load('TRK-X', true);
    await tick();
    await tick();

    controller.unload(); // navigating via /library
    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-Y', 'TRK-Y') as never);
    controller.load('TRK-Y', true);
    await tick();
    await tick();

    expect(currentStream()).toContain('PL-Y');
  });

  it('never reuses an in-flight session from the playlist being left', async () => {
    const { controller, usePlaylistStore } = await freshController();

    // The session request for X is still outstanding when the user moves to Y.
    let release: () => void = () => {};
    sessionDelay = new Promise<void>((r) => {
      release = r;
    });

    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-X', 'TRK-X') as never);
    controller.load('TRK-X', true);
    await tick();

    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-Y', 'TRK-Y') as never);
    controller.load('TRK-Y', true);
    await tick();

    release();
    await tick();
    await tick();

    // Y must have asked for its OWN session rather than being handed X's in-flight promise,
    // which would have resolved to X's manifest URL.
    expect(sessionFor).toContain('PL-Y');
    expect(currentStream()).toContain('PL-Y');
  });

  it('leaves no playlist state behind after unload', async () => {
    const { controller, usePlaylistStore } = await freshController();

    usePlaylistStore.getState().setPlaylistData(uploadPlaylist('PL-X', 'TRK-X') as never);
    controller.load('TRK-X', true);
    await tick();
    await tick();

    controller.unload();

    // A reload/remount must not be able to reach anything belonging to the old playlist.
    const state = controller as unknown as Record<string, unknown>;
    expect(state.playlistUrl).toBe('');
    expect(state.playlistId).toBe('');
    expect(state.loadedPlaylistId).toBeNull();
    expect(state.sessionPromise).toBeNull();
  });
});
