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

function setNetworkErrorFlag(on: boolean, reason?: string) {
  try {
    usePlayerStore.getState().setNetworkError(on, reason);
  } catch {
    /* noop for non-react contexts */
  }
}

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
  const RETRY_EVERY = 5000;
  const GAP_BETWEEN_TRACKS = 2.005; // sec silent segment
  const AUTOSWITCH_PREROLL = 0.5;   // sec preroll between new track start
  const MIN_BUFFER_BEFORE_PLAY = 3; // min 3 sec in buffer
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
  let isinitMediaSession = false;

  let seekGraceUntil = 0;
  function inSeekGrace() { return Date.now() < seekGraceUntil; }
  function startSeekGrace(ms = 1000) { seekGraceUntil = Date.now() + ms; }

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
    tracks.forEach((t, i) => {
      const d = Math.max(0, Number(t.duration) || 0);
      offsets.set(t.id, acc);
      durations.set(t.id, d);

      acc += d;
      if (i < tracks.length - 1) acc += GAP_BETWEEN_TRACKS;
    });

    totalDuration = acc;
  }

  function clearRetry() {
    if (retryTimer !== null) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    setNetworkErrorFlag(false);
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
        fragLoadingTimeOut: RETRY_EVERY,
         maxMaxBufferLength: 0,
         maxBufferSize: 0,
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
        playWhenBuffered().catch(() => { });
      }
    } else {
      const t = audio.currentTime || 0;
      const wasPlaying = wantPlaying;
      audio.src = playlistUrl + (playlistUrl.includes('?') ? '&' : '?') + 'r=' + Date.now();
      audio.load();
      audio.currentTime = t;
      if (wasPlaying) playWhenBuffered().catch(() => { });
    }
  }

  function scheduleRetry() {
    if (!wantPlaying) return;
    if (retryTimer !== null) return;
    setNetworkErrorFlag(true, navigator.onLine ? 'retrying' : 'offline');
    attemptResume(true);
    retryTimer = window.setInterval(() => {
      attemptResume(false);
    }, RETRY_EVERY);
  }

  function onMediaHiccup(_evt: Event) {
    if (!wantPlaying) return;

    if (isSeeking || inSeekGrace()) return;

    if (!navigator.onLine) {
      setNetworkErrorFlag(true, 'offline');
      scheduleRetry();
      return;
    }

    // Иначе просто пробуем восстановиться без поднятия флага
    attemptResume(true);
  }

  function wireHlsErrorHandlers() {
    if (!hls) return;
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        setNetworkErrorFlag(true, 'network-error');
        scheduleRetry();
      }
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setNetworkErrorFlag(true, 'network-error-fatal');
            scheduleRetry();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { hls?.recoverMediaError(); } catch { }
            break;
          default:
            setNetworkErrorFlag(true, 'fatal-error');
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
        fragLoadingTimeOut: RETRY_EVERY,
        // for network problems tests
        // maxBufferLength: 2,
        // maxMaxBufferLength: 2,
      });
      hls.loadSource(playlistUrl);
      hls.attachMedia(audio);
      wireHlsErrorHandlers();
      try { hls.startLoad(-1); } catch { }
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
    audio.addEventListener('canplaythrough', () => {
      setNetworkErrorFlag(false);
    });
    audio.addEventListener('seeking', () => {
      isSeeking = true;
      startSeekGrace(1200); // во время перемотки и чуть после
    });

    audio.addEventListener('seeked', () => {
      isSeeking = false;
      startSeekGrace(800); // короткий «хвост» после перемотки
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
    window.addEventListener('offline', () => {
      setNetworkErrorFlag(true, 'offline');
      scheduleRetry();
    });

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
          goToTrack(newId, shouldAutoplay, true);
          wantPlaying = true;
        } else {
          pause();
          seek(0, currentTrackId)
        }
      }
    });
  }

  function findTrackByGlobalTime(t: number): string | null {
    if (!tracksIds.length) return null;

    for (let i = 0; i < tracksIds.length; i++) {
      const id = tracksIds[i];
      const start = offsets.get(id) || 0;
      const dur = durations.get(id) || 0;
      const end = start + dur;
      const nextStart = i + 1 < tracksIds.length ? (offsets.get(tracksIds[i + 1]) || 0) : Infinity;

      // inside track
      if (t >= start && t < end) return id;

      // inside silent - time to next track
      if (t >= end && t < nextStart) {
        return i + 1 < tracksIds.length ? tracksIds[i + 1] : id;
      }
    }

    // outside the border — return last
    return tracksIds[tracksIds.length - 1] || null;
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

  function msInitSession(trackId: string | null) {
    // Media Session buttons\
    if (isinitMediaSession) return;
    msInit({
      onPlay: () => play(),
      onPause: () => pause(),
      onStop: () => stop(),
      onSeekTo: (t: number) => {
        seek(t);
      },
    });
    isinitMediaSession = true;
    msSyncMetadata(trackId || '')
  }

  function msSyncMetadata(id?: string) {
    const trackId = id || currentTrackId;
    if (!trackId || !isinitMediaSession) return;
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
      onNext: getNextTrackId() ? () => { const nx = getNextTrackId()!; goToTrack(nx, true, true); } : null,
      onPrev: getPrevTrackId() ? () => { const pv = getPrevTrackId()!; goToTrack(pv, true, true); } : null,
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

  function getBufferedAhead(): number {
    const t = audio.currentTime || 0;
    const buf = audio.buffered;
    for (let i = 0; i < buf.length; i++) {
      const start = buf.start(i);
      const end = buf.end(i);
      if (t >= start && t <= end) {
        return Math.max(0, end - t);
      }
    }
    return 0;
  }

  function playWhenBuffered(minSec = MIN_BUFFER_BEFORE_PLAY): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!wantPlaying) return resolve(); // если уже не хотим играть — выходим

      const tryPlay = () => {
        if (!wantPlaying) {
          cleanup();
          return resolve();
        }
        const ahead = getBufferedAhead();
        if (ahead >= minSec) {
          cleanup();
          audio.play().then(resolve).catch(err => reject(err));
        }
      };

      const onProgress = () => tryPlay();
      const onTimeUpdate = () => tryPlay();
      const onCanPlay = () => tryPlay();
      const onCanPlayThrough = () => tryPlay();
      const onFragLoaded = () => tryPlay();
      const onBufferAppended = () => tryPlay();

      const cleanup = () => {
        audio.removeEventListener('progress', onProgress);
        audio.removeEventListener('timeupdate', onTimeUpdate);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('canplaythrough', onCanPlayThrough);
        try { hls?.off(Hls.Events.FRAG_LOADED as any, onFragLoaded as any); } catch {}
        try { hls?.off(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch {}
        if (timer) clearTimeout(timer);
      };

      // Fallback: if can't start on 5 sec - play as it is
      const timer = window.setTimeout(() => {
        cleanup();
        audio.play().then(resolve).catch(err => reject(err));
      }, 5000);

      audio.addEventListener('progress', onProgress);
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('canplay', onCanPlay);
      audio.addEventListener('canplaythrough', onCanPlayThrough);

      try { hls?.on(Hls.Events.FRAG_LOADED as any, onFragLoaded as any); } catch {}
      try { hls?.on(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch {}

      // Первая попытка сразу
      tryPlay();
    });
  }

  function goToTrack(trackId: string, autoplay = false, preRollOnZero = false) {
    if (!isPlaylistLoaded) ensureHlsLoaded();
    if (!tracksIds.length) return;

    const start = offsets.get(trackId) || 0;
    const d = durations.get(trackId) || 0;
    const savedLocal = getSavedLocalTime(trackId);
    let target = start + savedLocal;
    if (preRollOnZero && savedLocal === 0) {
      target = Math.max(0, start - AUTOSWITCH_PREROLL);
    }

    selectCurrent(trackId);

    const shouldPlay = autoplay;
    if (shouldPlay) {
      wantPlaying = true; // start offline retries before play
    }
    isSeeking = true;
    audio.pause();

    const onSeeked = () => {
      audio.removeEventListener('seeked', onSeeked);
      isSeeking = false;

      usePlayerStore.setState({ inputCurrentTime: savedLocal });
      if (isinitMediaSession) {
        msUpdatePositionState({
          position: savedLocal,
          duration: d,
          playbackRate: shouldPlay ? 1 : 0
        }, true);
      }

      if (shouldPlay) {
        usePlayerStore.getState().setIsPlaying(true);
        playWhenBuffered().catch(() => {
          scheduleRetry();
        });
      }
    };

    audio.addEventListener('seeked', onSeeked);
    audio.currentTime = target;
  }

  function load(trackId: string, isPlayAfter: boolean = false) {
    if (!tracks.length) initPlaylist();
    ensureHlsLoaded();
    if (isPlayAfter) {
      wantPlaying = true; // offline retry support
      msInitSession(trackId);
      selectCurrent(trackId);
      usePlayerStore.getState().setIsPlaying(true);
      scheduleRetry(); // start offline retry support and don't waiting hls events
    }
    playAfterLoad = isPlayAfter;

    const onReady = () => {
      audio.removeEventListener('loadedmetadata', onReady);
      goToTrack(trackId, playAfterLoad, true);
      playAfterLoad = false;
    };
    if (audio.readyState >= 1) {
      goToTrack(trackId, isPlayAfter, true);
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
    msInitSession(currentTrackId);
    wantPlaying = true;
    usePlayerStore.getState().setIsPlaying(true);
    msSetPlaybackState('playing');
    playWhenBuffered().catch(() => {
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
    setNetworkErrorFlag(false);
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('none');
    audio.pause();
  }


  function seek(seconds: number, trackId?: string) {
    console.log('seek',seconds, trackId);
    const id = trackId || currentTrackId;
    if (!id) return;
    const start = offsets.get(id) || 0;
    const d = durations.get(id) || 0;
    const local = Math.min(Math.max(0, seconds), d);
    audio.currentTime = start + local;

    usePlayerStore.getState().setTrackTime(id, local);
    if (isinitMediaSession) {
      msUpdatePositionState({position: local, duration: d, playbackRate: audio.paused ? 0 : 1}, true);
    }
    usePlayerStore.setState({ inputCurrentTime: local });
  }

  function unload() {
    wantPlaying = false;
    clearRetry();
    setNetworkErrorFlag(false);
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

  ['stalled','suspend','waiting','emptied','error','abort'].forEach((ev) => {
    audio.addEventListener(ev, onMediaHiccup);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') attemptResume(true);
  });
  window.addEventListener('pageshow', () => attemptResume(true));
  window.addEventListener('focus', () => attemptResume(true));

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

  // Do NOT publish to zustand store here – this happens in React layer (AudioProvider)

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
