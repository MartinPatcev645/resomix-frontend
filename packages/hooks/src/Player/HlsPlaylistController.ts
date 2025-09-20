import Hls from 'hls.js';
import { Track, usePlayerStore, usePlaylistStore } from '@resomix/stores';
import {
  msInit,
  msSetMetadata,
  msSetPlaybackState,
  msSetTrackControls,
  msUpdatePositionState,
  msReset,
} from './mediaSessionActions';
import { getSimilarityPlaylistHlsUrl } from "@resomix/api-client";

export interface AudioController {
  load: (trackId: string, isPlayAfter?: boolean) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number, trackId?: string) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  unload: () => void;
  readonly isLoaded: boolean;
}

export function createHlsPlaylistController(): AudioController {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';

  let hls: Hls | null = null;

  let playlistUrl = '';
  let retryTimer: number | null = null;
  const RETRY_EVERY = 2000;
  let wantPlaying = false;

  let tracksIds: string[] = [];
  let tracks: Track[] = [];
  let maxTrackLength: number = 0;
  let playlistName = '';
  let playlistId = '';

  let offsets: Map<string, number> = new Map(); // trackId -> start time in the global stream
  let durations: Map<string, number> = new Map();
  let totalDuration = 0;

  let currentTrackId: string | null = null;
  let isPlaylistLoaded = false;
  let playAfterLoad = false;

  let isSeeking = false;

  function initPlaylist() {
    const playlistData = usePlaylistStore.getState().playlistData;
    if (!playlistData) return;

    tracks = [];
    if (playlistData.queried_track?.id) tracks.push(playlistData.queried_track);
    if (playlistData.similar_tracks?.length) tracks = [...tracks, ...playlistData.similar_tracks];

    playlistName = playlistData.playlist?.name || '';
    playlistId = playlistData.playlist?.id || '';

    tracksIds = tracks.map(t => {
      if (t.duration > maxTrackLength) maxTrackLength = t.duration;
      return t.id;
    });

    offsets = new Map();
    durations = new Map();
    let acc = 0;
    for (const t of tracks) {
      const d = Math.max(0, Number(t.duration) || 0);
      offsets.set(t.id, acc);
      durations.set(t.id, d);
      acc += d;
    }
    totalDuration = acc;
  }

  function clearRetry() {
    if (retryTimer !== null) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  }

  function restartHls() {
    if (!playlistUrl) return;
    if (hls) {
      try { hls.destroy(); } catch { }
      hls = null;
    }
    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
      });
      hls.attachMedia(audio);
      hls.loadSource(playlistUrl);
      wireHlsErrorHandlers();
    }
  }

  function attemptResume(immediate = false) {
    if (!wantPlaying) return;
    if (!navigator.onLine) return;

    if (Hls.isSupported()) {
      if (!hls) {
        restartHls();
      } else {
        try {
          hls.startLoad(audio.currentTime || -1);
        } catch {
          restartHls();
        }
      }
      if (immediate) {
        audio.play().catch(() => { });
      }
    } else {
      const t = audio.currentTime || 0;
      const wasPlaying = wantPlaying;
      audio.src = playlistUrl;
      audio.load();
      audio.currentTime = t;
      if (wasPlaying) audio.play().catch(() => { });
    }
  }

  function scheduleRetry() {
    if (!wantPlaying) return;
    if (retryTimer !== null) return;
    attemptResume(true);
    retryTimer = window.setInterval(() => {
      attemptResume(false);
    }, RETRY_EVERY);
  }

  function wireHlsErrorHandlers() {
    if (!hls) return;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        scheduleRetry();
      }
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            scheduleRetry();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { hls?.recoverMediaError(); } catch { }
            break;
          default:
            restartHls();
            scheduleRetry();
            break;
        }
      }
    });

    hls.on(Hls.Events.MANIFEST_PARSED, clearRetry);
    hls.on(Hls.Events.LEVEL_LOADED, clearRetry);
    hls.on(Hls.Events.FRAG_LOADED, clearRetry);
  }

  function ensureHlsLoaded() {
    if (isPlaylistLoaded) return;
    if (!tracks.length) initPlaylist();
    if (!tracksIds.length) return;

    playlistUrl = getSimilarityPlaylistHlsUrl(playlistId);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
      });
      hls.loadSource(playlistUrl);
      hls.attachMedia(audio);
      wireHlsErrorHandlers();
    } else {
      audio.src = playlistUrl;
    }

    wireEvents();
    isPlaylistLoaded = true;
  }

  function wireEvents() {
    audio.addEventListener('play', () => {
      msSetPlaybackState('playing');
    });
    audio.addEventListener('pause', () => {
      // msSetPlaybackState('paused');
    });
    audio.addEventListener('ended', () => {
      wantPlaying = false;
      clearRetry();
      msSetPlaybackState('none');
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setCurrentTrack(null);
      msUpdatePositionState({ position: totalDuration, duration: totalDuration, playbackRate: 0 }, true);
    });

    window.addEventListener('online', () => attemptResume(true));
    window.addEventListener('offline', () => scheduleRetry());

    audio.addEventListener('timeupdate', () => {
      if (!currentTrackId || isSeeking) return;

      const globalT = audio.currentTime || 0;
      const start = offsets.get(currentTrackId) || 0;
      const localT = Math.max(0, globalT - start);

      usePlayerStore.setState({ inputCurrentTime: localT });
      usePlayerStore.getState().setTrackTime(currentTrackId, localT);
      msUpdatePositionState({
        position: localT,
        duration: durations.get(currentTrackId) || 0,
        playbackRate: audio.paused ? 0 : 1
      }, false);

      const newId = findTrackByGlobalTime(globalT);
      if (newId && newId !== currentTrackId) {
        usePlayerStore.getState().setTrackTime(currentTrackId, 0);
        const { autoplay } = usePlayerStore.getState();
        if (autoplay) {
          const shouldAutoplay = !audio.paused;
          goToTrack(newId, shouldAutoplay);
          wantPlaying = true;
        } else {
          pause();
          seek(0, currentTrackId)
        }
      }
    });
  }

  function findTrackByGlobalTime(t: number): string | null {
    t += 0.7;
    let lastId: string | null = null;
    for (const id of tracksIds) {
      const start = offsets.get(id) || 0;
      const end = start + (durations.get(id) || 0);
      if (t >= start && t < end) return id;
      if (t >= end) lastId = id;
    }
    return lastId;
  }

  function getNextTrackId(): string | null {
    if (!currentTrackId) return null;
    const i = tracksIds.indexOf(currentTrackId);
    if (i < 0 || i + 1 >= tracksIds.length) return null;
    return tracksIds[i + 1];
  }
  function getPrevTrackId(): string | null {
    if (!currentTrackId) return null;
    const i = tracksIds.indexOf(currentTrackId);
    if (i <= 0) return null;
    return tracksIds[i - 1];
  }

  function msSyncMetadata(id?: string) {
    const trackId = id || currentTrackId;
    if (!trackId) return;
    const t = tracks.find(x => x.id === trackId);
    if (!t) return;
    msSetMetadata({
      title: t.title || 'Resomix Track',
      artist: t.artist || 'Music Discovery',
      album: playlistName || 'Similarity Playlist',
      artwork: [
        { src: '/logo.png', sizes: '96x96', type: 'image/png' },
        { src: '/logo.png', sizes: '128x128', type: 'image/png' },
        { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      ]
    });
    msSetTrackControls({
      onNext: getNextTrackId() ? () => { const nx = getNextTrackId()!; goToTrack(nx, true); } : null,
      onPrev: getPrevTrackId() ? () => { const pv = getPrevTrackId()!; goToTrack(pv, true); } : null,
    });
  }

  function selectCurrent(id: string) {
    currentTrackId = id;
    usePlayerStore.getState().setCurrentTrack(id);
    usePlayerStore.setState({ isLoaded: true });
    msSyncMetadata(id);
  }

  function getSavedLocalTime(trackId: string): number {
    const d = durations.get(trackId) || 0;
    const saved = usePlayerStore.getState().getTrackTime(trackId) || 0;
    const max = d > 0.25 ? d - 0.25 : d;
    return Math.min(Math.max(0, saved), max);
  }

  function goToTrack(trackId: string, autoplay = false) {
    if (!isPlaylistLoaded) ensureHlsLoaded();
    if (!tracksIds.length) return;

    const start = offsets.get(trackId) || 0;
    const d = durations.get(trackId) || 0;
    const savedLocal = getSavedLocalTime(trackId);
    const target = start + savedLocal;

    selectCurrent(trackId);

    const shouldPlay = autoplay;
    isSeeking = true;
    audio.pause();

    const onSeeked = () => {
      audio.removeEventListener('seeked', onSeeked);
      isSeeking = false;

      usePlayerStore.setState({ inputCurrentTime: savedLocal });
      msUpdatePositionState({
        position: savedLocal,
        duration: d,
        playbackRate: shouldPlay ? 1 : 0
      }, true);

      if (shouldPlay) {
        usePlayerStore.getState().setIsPlaying(true);
        audio.play().catch(() => { });
      }
    };

    audio.addEventListener('seeked', onSeeked);
    audio.currentTime = target;
  }

  function load(trackId: string, isPlayAfter: boolean = false) {
    if (!tracks.length) initPlaylist();
    ensureHlsLoaded();
    playAfterLoad = isPlayAfter;

    const onReady = () => {
      audio.removeEventListener('loadedmetadata', onReady);
      goToTrack(trackId, playAfterLoad);
      playAfterLoad = false;
    };
    if (audio.readyState >= 1) {
      goToTrack(trackId, isPlayAfter);
    } else {
      audio.addEventListener('loadedmetadata', onReady);
    }
  }

  function play() {
    if (!currentTrackId && tracksIds.length) {
      wantPlaying = true;
      load(tracksIds[0], true);
      return;
    }
    wantPlaying = true;
    usePlayerStore.getState().setIsPlaying(true);
    msSetPlaybackState('playing');
    audio.play().catch(() => {
      scheduleRetry();
    });
  }

  function pause() {
    wantPlaying = false;
    clearRetry();
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('paused');
    audio.pause();
  }

  function stop() {
    wantPlaying = false;
    clearRetry();
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('none');
    audio.pause();
  }


  function seek(seconds: number, trackId?: string) {
    const id = trackId || currentTrackId;
    if (!id) return;
    const start = offsets.get(id) || 0;
    const d = durations.get(id) || 0;
    const local = Math.min(Math.max(0, seconds), d);
    audio.currentTime = start + local;

    usePlayerStore.getState().setTrackTime(id, local);
    msUpdatePositionState({ position: local, duration: d, playbackRate: audio.paused ? 0 : 1 }, true);
    usePlayerStore.setState({ inputCurrentTime: local });
  }

  function unload() {
    wantPlaying = false;
    clearRetry();
    audio.pause();
    if (hls) {
      try { hls.destroy(); } catch { }
      hls = null;
    }
    audio.removeAttribute('src');
    audio.load();

    isPlaylistLoaded = false;
    currentTrackId = null;
    msReset();
    usePlayerStore.setState({ isLoaded: false });
  }

  function getCurrentTime() {
    if (!currentTrackId) return 0;
    const start = offsets.get(currentTrackId) || 0;
    return Math.max(0, (audio.currentTime || 0) - start);
  }

  function getDuration() {
    if (!currentTrackId) return 0;
    return durations.get(currentTrackId) || 0;
  }

  // volume sync
  let lastVolume = usePlayerStore.getState().volume;
  audio.volume = lastVolume;
  usePlayerStore.subscribe(() => {
    const volume = usePlayerStore.getState().volume;
    if (volume !== lastVolume) {
      lastVolume = volume;
      audio.volume = volume;
    }
  });

  // Media Session buttons
  msInit({
    onPlay: () => play(),
    onPause: () => pause(),
    onStop: () => stop(),
    onSeekTo: (t: number) => {
      // t — absolute time to local
      if (!currentTrackId) return;
      const start = offsets.get(currentTrackId) || 0;
      seek(Math.max(0, t - start));
    },
  });

  const controller: AudioController = {
    load,
    play,
    pause,
    stop,
    seek,
    getCurrentTime,
    getDuration,
    unload,
    get isLoaded() { return !!(audio.readyState >= 1); },
  };

  try {
    usePlayerStore.getState().setAudioController(controller);
  } catch {
    // ignore in non-react contexts
  }

  return controller;
}

// Global cache
const KEY = '__RESOMIX_AUDIO_CONTROLLER__';

export function getOrCreateAudioController(): AudioController {
  if (typeof window === 'undefined') {
    throw new Error('AudioController is client-only');
  }
  const g = globalThis as any;
  if (!g[KEY]) {
    g[KEY] = createHlsPlaylistController();
    // HMR-friendly
    try {
      // @ts-ignore
      if (import.meta?.hot) {
        // @ts-ignore
        import.meta.hot.accept?.();
        // @ts-ignore
        import.meta.hot.dispose?.(() => { });
      }
    } catch {
      /* noop */
    }
  }
  return g[KEY] as AudioController;
}
