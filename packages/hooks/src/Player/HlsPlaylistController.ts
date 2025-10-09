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

// ================== Config ==================
const RETRY_EVERY = 8000;
const GAP_BETWEEN_TRACKS = 2.005; // sec silent segment
const AUTOSWITCH_PREROLL = 0.5;   // sec preroll between new track start
const MIN_BUFFER_BEFORE_PLAY = 6; // sec in buffer before play
const PLAY_FALLBACK_AFTER_MS = 5000;

// ================== Helpers ==================
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

// ================== Controller ==================
class HlsPlaylistController implements AudioController {
  private readonly audio: HTMLAudioElement;
  private hls: Hls | null = null;

  private playlistUrl = '';
  private retryTimer: number | null = null;
  private coldRetryTimer: number | null = null;

  private wantPlaying = false;
  private playAfterLoad = false;

  private tracks: Track[] = [];
  private tracksIds: string[] = [];
  private playlistName = '';
  private playlistId = '';

  private offsets: Map<string, number> = new Map(); // trackId -> start time in the global stream
  private durations: Map<string, number> = new Map();
  private totalDuration = 0;

  private currentTrackId: string | null = null;
  private isPlaylistLoaded = false;

  private isSeeking = false;
  private isMediaSessionInit = false;
  private seekGraceUntil = 0;
  private wiredGlobalEvents = false;
  private wiredAudioEvents = false;
  private volumeUnsubscribe: (() => void) | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';

    // volume sync once per controller lifetime
    let lastVolume = usePlayerStore.getState().volume;
    this.audio.volume = lastVolume;
    this.volumeUnsubscribe = usePlayerStore.subscribe(() => {
      const volume = usePlayerStore.getState().volume;
      if (volume !== lastVolume) {
        lastVolume = volume;
        this.audio.volume = volume;
      }
    });

    // media hiccup watcher
    ['stalled','suspend','waiting','emptied','error','abort'].forEach((ev) => {
      this.audio.addEventListener(ev, this.onMediaHiccup);
    });

    // global visibility/focus signals
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('focus', this.onWindowFocus);

    this.wireGlobalOnlineOffline();
  }

  // =============== Public API ===============

  load = (trackId: string, isPlayAfter: boolean = false) => {
    setNetworkErrorFlag(false);
    this.clearRetry();

    if (!this.tracks.length) this.initPlaylist();

    // Ensure HLS not in error state
    if (this.hls && (this.hls.currentLevel === -1 || this.hls.media === null)) {
      this.scheduleRetry(false);
    }

    this.ensureHlsLoaded();

    if (isPlayAfter) {
      this.wantPlaying = true;
      this.msInitSession(trackId);
      this.selectCurrent(trackId);
      usePlayerStore.getState().setIsPlaying(true);
    }
    this.playAfterLoad = isPlayAfter;

    const onReady = () => {
      this.audio.removeEventListener('loadedmetadata', onReady);
      this.goToTrack(trackId, this.playAfterLoad, true);
      this.playAfterLoad = false;
    };

    if (this.audio.readyState >= 1) {
      this.goToTrack(trackId, isPlayAfter, true);
    } else {
      this.audio.addEventListener('loadedmetadata', onReady);
    }
  };

  play = () => {
    if (!this.currentTrackId && this.tracksIds.length) {
      this.wantPlaying = true;
      this.load(this.tracksIds[0], true);
      return;
    }
    this.msInitSession(this.currentTrackId || null);
    this.wantPlaying = true;
    usePlayerStore.getState().setIsPlaying(true);
    msSetPlaybackState('playing');
    this.playWhenBuffered().catch(() => this.scheduleRetry());
  };

  pause = () => {
    this.wantPlaying = false;
    this.clearRetry();
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('paused');
    this.audio.pause();
  };

  stop = () => {
    this.wantPlaying = false;
    this.clearRetry();
    setNetworkErrorFlag(false);
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('none');
    this.audio.pause();
  };

  seek = (seconds: number, trackId?: string) => {
    const id = trackId || this.currentTrackId;
    if (!id) return;

    const start = this.offsets.get(id) || 0;
    const d = this.durations.get(id) || 0;
    const local = Math.min(Math.max(0, seconds), d);

    this.audio.currentTime = start + local;
    usePlayerStore.getState().setTrackTime(id, local);

    if (this.isMediaSessionInit) {
      msUpdatePositionState({
        position: local,
        duration: d,
        playbackRate: this.audio.paused ? 0 : 1
      }, true);
    }
    usePlayerStore.setState({ inputCurrentTime: local });
  };

  unload = () => {
    this.wantPlaying = false;
    this.clearRetry();
    setNetworkErrorFlag(false);
    this.audio.pause();

    if (this.hls) {
      try { this.hls.destroy(); } catch { /* noop */ }
      this.hls = null;
    }

    this.audio.removeAttribute('src');
    this.audio.load();

    this.isPlaylistLoaded = false;
    this.currentTrackId = null;
    msReset();
    usePlayerStore.setState({ isLoaded: false });
  };

  getCurrentTime = () => {
    if (!this.currentTrackId) return 0;
    const start = this.offsets.get(this.currentTrackId) || 0;
    return Math.max(0, (this.audio.currentTime || 0) - start);
  };

  getDuration = () => {
    if (!this.currentTrackId) return 0;
    return this.durations.get(this.currentTrackId) || 0;
  };

  get isLoaded() {
    return !!(this.audio.readyState >= 1);
  }

  // =============== Private: playlist/timeline ===============

  private initPlaylist() {
    const playlistData = usePlaylistStore.getState().playlistData;
    if (!playlistData) return;

    this.tracks = [];
    if (playlistData.queried_track?.id) this.tracks.push(playlistData.queried_track);
    if (playlistData.similar_tracks?.length) this.tracks = [...this.tracks, ...playlistData.similar_tracks];

    this.playlistName = playlistData.playlist?.name || '';
    this.playlistId = playlistData.playlist?.id || '';

    this.tracksIds = this.tracks.map(t => t.id);
    this.buildTimeline();
  }

  private buildTimeline() {
    this.offsets = new Map();
    this.durations = new Map();

    let acc = 0;
    this.tracks.forEach((t, i) => {
      const d = Math.max(0, Number(t.duration) || 0);
      this.offsets.set(t.id, acc);
      this.durations.set(t.id, d);
      acc += d;
      if (i < this.tracks.length - 1) acc += GAP_BETWEEN_TRACKS;
    });

    this.totalDuration = acc;
  }

  private getSavedLocalTime(trackId: string) {
    const d = this.durations.get(trackId) || 0;
    const saved = usePlayerStore.getState().getTrackTime(trackId) || 0;
    const max = d > 0.25 ? d - 0.25 : d;
    return Math.min(Math.max(0, saved), max);
  }

  // =============== Private: HLS lifecycle ===============

  private ensureHlsLoaded() {
    if (this.isPlaylistLoaded) return;
    if (!this.tracks.length) this.initPlaylist();
    if (!this.tracksIds.length) return;

    this.playlistUrl = getSimilarityPlaylistHlsUrl(this.playlistId);

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
      });
      this.hls.loadSource(this.playlistUrl);
      this.hls.attachMedia(this.audio);
      this.wireHlsErrorHandlers();
      try { this.hls.startLoad(-1); } catch { /* noop */ }
    } else {
      // Safari / native HLS
      this.audio.src = this.playlistUrl;
      this.audio.load();
    }

    this.wireAudioEvents();
    this.isPlaylistLoaded = true;

    if (!navigator.onLine) {
      this.scheduleColdRetry('offline');
    }
  }

  private restartHls() {
    if (!this.playlistUrl) return;

    if (this.hls) {
      try { this.hls.destroy(); } catch { /* noop */ }
      this.hls = null;
    }

    if (Hls.isSupported()) {
      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
      });
      this.hls.attachMedia(this.audio);
      this.hls.loadSource(this.playlistUrl);
      this.wireHlsErrorHandlers();
    }

    return this.hls;
  }

  // =============== Private: events ===============

  private wireAudioEvents() {
    if (this.wiredAudioEvents) return;
    this.wiredAudioEvents = true;

    this.audio.addEventListener('play', () => {
      msSetPlaybackState('playing');
    });
    this.audio.addEventListener('pause', () => {
      // keep silent, state handled in pause()
    });
    this.audio.addEventListener('canplaythrough', () => {
      setNetworkErrorFlag(false);
    });
    this.audio.addEventListener('canplay', () => setNetworkErrorFlag(false));
    this.audio.addEventListener('playing', () => setNetworkErrorFlag(false));

    this.audio.addEventListener('seeking', () => {
      this.isSeeking = true;
      this.startSeekGrace(1200);
    });
    this.audio.addEventListener('seeked', () => {
      this.isSeeking = false;
      this.startSeekGrace(800);
    });

    this.audio.addEventListener('ended', () => {
      this.wantPlaying = false;
      this.clearRetry();
      msSetPlaybackState('none');
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setCurrentTrack(null);
      msUpdatePositionState({ position: this.totalDuration, duration: this.totalDuration, playbackRate: 0 }, true);
    });

    this.audio.addEventListener('timeupdate', this.onTimeUpdate);
  }

  private wireGlobalOnlineOffline() {
    if (this.wiredGlobalEvents) return;
    this.wiredGlobalEvents = true;

    window.addEventListener('online', () => {
      console.log('--return window online');
      setNetworkErrorFlag(false);
      this.attemptResume(true, true);
    });
    window.addEventListener('offline', () => {
      setNetworkErrorFlag(true, 'offline');
      this.scheduleRetry();
    });
  }

  private wireHlsErrorHandlers() {
    if (!this.hls) return;

    const SERIOUS_NET_DETAILS = new Set([
      Hls.ErrorDetails.MANIFEST_LOAD_ERROR,
      Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT,
      Hls.ErrorDetails.LEVEL_LOAD_ERROR,
      Hls.ErrorDetails.LEVEL_LOAD_TIMEOUT,
      Hls.ErrorDetails.FRAG_LOAD_ERROR,
      Hls.ErrorDetails.FRAG_LOAD_TIMEOUT,
      Hls.ErrorDetails.KEY_LOAD_ERROR,
      Hls.ErrorDetails.KEY_LOAD_TIMEOUT,
      Hls.ErrorDetails.AUDIO_TRACK_LOAD_ERROR,
      Hls.ErrorDetails.AUDIO_TRACK_LOAD_TIMEOUT,
      Hls.ErrorDetails.SUBTITLE_LOAD_ERROR,
      Hls.ErrorDetails.SUBTITLE_TRACK_LOAD_TIMEOUT,
      Hls.ErrorDetails.ASSET_LIST_LOAD_ERROR,
      Hls.ErrorDetails.ASSET_LIST_LOAD_TIMEOUT,
    ]);

    const isAbortError = (data: any) =>
      data?.details === Hls.ErrorDetails.INTERNAL_ABORTED;

    const isSeriousNetworkError = (data: any) => {
      if (!navigator.onLine) return true;
      if (SERIOUS_NET_DETAILS.has(data?.details)) return true;
      if (data?.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
        const code = data?.response?.code ?? data?.response?.status;
        if (typeof code === 'number' && code >= 400) return true;
      }
      return false;
    };

    this.hls.on(Hls.Events.ERROR, (_e, data) => {
      if (isAbortError(data)) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        if (isSeriousNetworkError(data)) {
          setNetworkErrorFlag(true, data?.details || (navigator.onLine ? 'network-error' : 'offline'));
          if (this.wantPlaying) {
            this.scheduleRetry(true, data?.details);
          } else {
            this.scheduleColdRetry(data?.details);
          }
        } else {
          this.attemptResume(true, !this.wantPlaying /* allowCold если не играем */);
        }
        return;
      }

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { this.hls?.recoverMediaError(); } catch {}
            break;
          default:
            setNetworkErrorFlag(true, 'fatal-error');
            this.restartHls();
            if (this.wantPlaying) {
              this.scheduleRetry(true, 'fatal-error');
            } else {
              this.scheduleColdRetry('fatal-error');
            }
            break;
        }
      }
    });

    const clear = () => {
      this.clearRetry();
      this.clearColdRetry();
    }
    this.hls.on(Hls.Events.MANIFEST_PARSED, clear);
    this.hls.on(Hls.Events.LEVEL_LOADED, clear);
    this.hls.on(Hls.Events.FRAG_LOADED, clear);
  }

  // =============== Private: resume/retry ===============

  private attemptResume(immediate = false, allowCold = false) {
    if (!allowCold && !this.wantPlaying) return;
    if (!navigator.onLine) return;

    if (!this.isPlaylistLoaded) {
      this.ensureHlsLoaded();
    }

    if (Hls.isSupported()) {
      const t = this.audio.currentTime || 0;

      if (!this.hls) {
        this.hls = this.restartHls() || null;
        try {
          if (this.hls && typeof this.hls.startLoad === 'function') {
            this.hls.startLoad(t || -1);
          }
        } catch { /* noop */ }
      } else {
        const bufAhead = this.getBufferedAhead();
        const isStalled = this.audio.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || bufAhead < 0.25;

        try { if (isStalled) this.hls.stopLoad(); } catch { /* noop */ }
        try {
          this.hls.startLoad(this.audio.currentTime || -1);
        } catch {
          this.restartHls();
          try { this.hls?.startLoad(this.audio.currentTime || -1); } catch { /* noop */ }
        }
      }

      if (immediate && this.wantPlaying) {
        this.playWhenBuffered().catch(() => { /* retry timer and hiccup handler backstop */ });
      }
    } else {
      // Safari / native HLS
      const t = this.audio.currentTime || 0;
      const wasPlaying = this.wantPlaying;
      this.audio.src = this.playlistUrl + (this.playlistUrl.includes('?') ? '&' : '?') + 'r=' + Date.now();
      this.audio.load();
      this.audio.currentTime = t;
      if (wasPlaying) this.playWhenBuffered().catch(() => {});
    }
  }

  private scheduleRetry(showFlag = false, reason?: string) {
    if (!this.wantPlaying) return;
    if (this.retryTimer !== null) return;
    if (showFlag) {
      setNetworkErrorFlag(true, reason || (navigator.onLine ? 'retrying' : 'offline'));
    }
    this.attemptResume(true);
    this.retryTimer = window.setInterval(() => {
      this.attemptResume(false);
    }, RETRY_EVERY);
  }

  private scheduleColdRetry(reason?: string) {
    if (this.coldRetryTimer !== null) return;
    setNetworkErrorFlag(true, reason || (navigator.onLine ? 'retrying' : 'offline'));
    this.attemptResume(true, true);
    this.coldRetryTimer = window.setInterval(() => {
      this.attemptResume(false, true);
    }, RETRY_EVERY);
  }

  private clearColdRetry() {
    if (this.coldRetryTimer !== null) {
      clearInterval(this.coldRetryTimer);
      this.coldRetryTimer = null;
    }
  }

  private clearRetry() {
    if (this.retryTimer !== null) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    setNetworkErrorFlag(false);
  }

  // =============== Private: UI/MediaSession ===============

  private msInitSession(trackId: string | null) {
    if (this.isMediaSessionInit) return;

    msInit({
      onPlay: () => this.play(),
      onPause: () => this.pause(),
      onStop: () => this.stop(),
      onSeekTo: (t: number) => this.seek(t),
    });

    this.isMediaSessionInit = true;
    this.msSyncMetadata(trackId || undefined);
  }

  private msSyncMetadata(id?: string) {
    const trackId = id || this.currentTrackId;
    if (!trackId || !this.isMediaSessionInit) return;
    const t = this.tracks.find(x => x.id === trackId);
    if (!t) return;

    msSetMetadata({
      title: t.title || 'Resomix Track',
      artist: t.artist || 'Music Discovery',
      album: this.playlistName || 'Similarity Playlist',
      artwork: [
        { src: '/logo.png', sizes: '96x96', type: 'image/png' },
        { src: '/logo.png', sizes: '128x128', type: 'image/png' },
        { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      ]
    });

    msSetTrackControls({
      onNext: this.getNextTrackId() ? () => { const nx = this.getNextTrackId()!; this.goToTrack(nx, true, true); } : null,
      onPrev: this.getPrevTrackId() ? () => { const pv = this.getPrevTrackId()!; this.goToTrack(pv, true, true); } : null,
    });
  }

  private selectCurrent(id: string) {
    this.currentTrackId = id;
    usePlayerStore.getState().setCurrentTrack(id);
    usePlayerStore.setState({ isLoaded: true });
    this.msSyncMetadata(id);
  }

  // =============== Private: time helpers ===============

  private getBufferedAhead(): number {
    const t = this.audio.currentTime || 0;
    const buf = this.audio.buffered;
    for (let i = 0; i < buf.length; i++) {
      const start = buf.start(i);
      const end = buf.end(i);
      if (t >= start && t <= end) {
        return Math.max(0, end - t);
      }
    }
    return 0;
  }

  private playWhenBuffered(minSec = MIN_BUFFER_BEFORE_PLAY): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.wantPlaying) return resolve();

      const tryPlay = () => {
        if (!this.wantPlaying) {
          cleanup();
          return resolve();
        }
        const ahead = this.getBufferedAhead();
        if (ahead >= minSec) {
          cleanup();
          this.audio.play().then(resolve).catch(reject);
        }
      };

      const onProgress = () => tryPlay();
      const onTimeUpdate = () => tryPlay();
      const onCanPlay = () => tryPlay();
      const onCanPlayThrough = () => tryPlay();
      const onBufferAppended = () => tryPlay();

      const cleanup = () => {
        this.audio.removeEventListener('progress', onProgress);
        this.audio.removeEventListener('timeupdate', onTimeUpdate);
        this.audio.removeEventListener('canplay', onCanPlay);
        this.audio.removeEventListener('canplaythrough', onCanPlayThrough);
        try { this.hls?.off(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch { /* noop */ }
        if (timer) clearTimeout(timer);
      };

      const timer = window.setTimeout(() => {
        cleanup();
        this.audio.play().then(resolve).catch(reject);
      }, PLAY_FALLBACK_AFTER_MS);

      this.audio.addEventListener('progress', onProgress);
      this.audio.addEventListener('timeupdate', onTimeUpdate);
      this.audio.addEventListener('canplay', onCanPlay);
      this.audio.addEventListener('canplaythrough', onCanPlayThrough);
      try { this.hls?.on(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch { /* noop */ }

      tryPlay();
    });
  }

  private goToTrack(trackId: string, autoplay = false, preRollOnZero = false) {
    if (!this.isPlaylistLoaded) this.ensureHlsLoaded();
    if (!this.tracksIds.length) return;

    const start = this.offsets.get(trackId) || 0;
    const d = this.durations.get(trackId) || 0;
    const savedLocal = this.getSavedLocalTime(trackId);

    let target = start + savedLocal;
    if (preRollOnZero && savedLocal === 0) {
      target = Math.max(0, start - AUTOSWITCH_PREROLL);
    }

    this.selectCurrent(trackId);

    const shouldPlay = autoplay;
    if (shouldPlay) {
      this.wantPlaying = true; // start offline retries before play
    }

    this.isSeeking = true;
    if (Hls.isSupported()) {
      this.audio.pause();
    }

    const onSeeked = () => {
      this.audio.removeEventListener('seeked', onSeeked);
      this.isSeeking = false;

      if (!Hls.isSupported()) {
        try {
          this.audio.currentTime = this.audio.currentTime + 0.001;
        } catch { /* noop */ }
      }

      usePlayerStore.setState({ inputCurrentTime: savedLocal });
      if (this.isMediaSessionInit) {
        msUpdatePositionState({
          position: savedLocal,
          duration: d,
          playbackRate: shouldPlay ? 1 : 0
        }, true);
      }

      if (shouldPlay) {
        usePlayerStore.getState().setIsPlaying(true);
        this.playWhenBuffered().catch(() => this.scheduleRetry(false));
      }
    };

    this.audio.addEventListener('seeked', onSeeked);
    this.audio.currentTime = target;
  }

  private findTrackByGlobalTime(t: number): string | null {
    if (!this.tracksIds.length) return null;

    for (let i = 0; i < this.tracksIds.length; i++) {
      const id = this.tracksIds[i];
      const start = this.offsets.get(id) || 0;
      const dur = this.durations.get(id) || 0;
      const end = start + dur;
      const nextStart = i + 1 < this.tracksIds.length ? (this.offsets.get(this.tracksIds[i + 1]) || 0) : Infinity;

      // inside track
      if (t >= start && t < end) return id;

      // inside silent - time to next track
      if (t >= end && t < nextStart) {
        return i + 1 < this.tracksIds.length ? this.tracksIds[i + 1] : id;
      }
    }

    // outside the border — return last
    return this.tracksIds[this.tracksIds.length - 1] || null;
  }

  private getNextTrackId(): string | null {
    if (!this.currentTrackId) return null;
    const i = this.tracksIds.indexOf(this.currentTrackId);
    if (i < 0 || i + 1 >= this.tracksIds.length) return null;
    return this.tracksIds[i + 1];
  }

  private getPrevTrackId(): string | null {
    if (!this.currentTrackId) return null;
    const i = this.tracksIds.indexOf(this.currentTrackId);
    if (i <= 0) return null;
    return this.tracksIds[i - 1];
  }

  // =============== Private: event handlers ===============

  private onTimeUpdate = () => {
    if (!this.currentTrackId || this.isSeeking) return;

    const globalT = this.audio.currentTime || 0;
    const start = this.offsets.get(this.currentTrackId) || 0;
    const localT = Math.max(0, globalT - start);

    usePlayerStore.setState({ inputCurrentTime: localT });
    usePlayerStore.getState().setTrackTime(this.currentTrackId, localT);

    msUpdatePositionState({
      position: localT,
      duration: this.durations.get(this.currentTrackId) || 0,
      playbackRate: this.audio.paused ? 0 : 1
    }, false);

    const newId = this.findTrackByGlobalTime(globalT);
    if (newId && newId !== this.currentTrackId) {
      usePlayerStore.getState().setTrackTime(this.currentTrackId, 0);
      const { autoplay } = usePlayerStore.getState();
      if (autoplay) {
        const shouldAutoplay = !this.audio.paused;
        this.goToTrack(newId, shouldAutoplay, true);
        this.wantPlaying = true;
      } else {
        this.pause();
        this.seek(0, this.currentTrackId);
      }
    }
  };

  private onMediaHiccup = (_evt: Event) => {
    if (!this.wantPlaying) return;
    if (this.isSeeking || this.inSeekGrace()) return;

    if (!navigator.onLine) {
      setNetworkErrorFlag(true, 'offline');
      this.scheduleRetry(true, 'offline');
      return;
    }
    this.attemptResume(true);
  };

  private onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.attemptResume(true);
  };
  private onPageShow = () => this.attemptResume(true);
  private onWindowFocus = () => this.attemptResume(true);

  // =============== Private: seek grace ===============

  private inSeekGrace() { return Date.now() < this.seekGraceUntil; }
  private startSeekGrace(ms = 1000) { this.seekGraceUntil = Date.now() + ms; }
}

// ================== Factory / Global cache ==================
export function createHlsPlaylistController(): AudioController {
  return new HlsPlaylistController();
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