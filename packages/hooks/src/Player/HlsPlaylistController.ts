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
import { getPlaylistPlaybackSession, API_CONFIG } from "@resomix/api-client";
import {DEMO_MODE} from "@resomix/config";

// ================== Config ==================
const RETRY_EVERY = 8000;
const GAP_BETWEEN_TRACKS = 2.005; // sec silent segment
const AUTOSWITCH_PREROLL = 0.5;   // sec preroll between new track start
const MIN_BUFFER_BEFORE_PLAY = 3; // sec in buffer before play
const PLAY_FALLBACK_AFTER_MS = 3000;
// How long a playback problem must PERSIST (while the user actually wants to play) before we surface
// the "Network" badge. This suppresses the initial-load / passive-preload window and transient
// buffering hiccups — the badge only appears for a real, sustained failure the user can perceive.
const NET_ERROR_GRACE_MS = 12000;

// ================== Helpers ==================
function setNetworkErrorFlag(on: boolean, reason?: string) {
  if (DEMO_MODE) return;
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
  // TWO dedicated <audio> elements — one per playback engine — so we never swap a source on a single
  // element (the old single-element swap raced badly under rapid play/pause and forced crossOrigin
  // toggling → CORS breakage). `hlsAudio` is hls.js-owned and always crossOrigin='anonymous' (peaks /
  // Web-Audio need CORS); `previewAudio` plays Apple Music preview URLs with NO crossOrigin (Apple's
  // preview CDN sends no CORS headers, and we never read its samples). Only one plays at a time.
  private readonly hlsAudio: HTMLAudioElement;
  private readonly previewAudio: HTMLAudioElement;
  private hls: Hls | null = null;

  private playlistUrl = '';
  private retryTimer: number | null = null;
  private coldRetryTimer: number | null = null;
  private netErrTimer: number | null = null;

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
  // Playback engine for the current track: 'hls' (the user's upload seed, streamed via hls.js on
  // `hlsAudio`) or 'preview' (a catalogue track, a plain <audio> src from the Apple Music preview_url
  // on `previewAudio`). Drives which element `audio` (below) resolves to.
  private mode: 'hls' | 'preview' = 'hls';
  private isPlaylistLoaded = false;
  private pendingOnReady: (() => void) | null = null;

  // Monotonic load generation. Every load()/loadPreview() bumps it; any async continuation captures
  // its seq and bails if a newer load has since superseded it — so rapid switching can't let a stale
  // callback act on the wrong track/element.
  private loadSeq = 0;

  private isSeeking = false;
  private isMediaSessionInit = false;
  private seekGraceUntil = 0;
  private wiredGlobalEvents = false;
  private wiredAudioEvents = false;
  private volumeUnsubscribe: (() => void) | null = null;
  private sessionPromise: Promise<any> | null = null;
  private lastRestartTime = 0;

  // One-shot listeners we may need to tear down on a track/mode switch, so a handler queued for a
  // superseded source can't fire against the new one. pendingOnReady/pendingSeeked live on hlsAudio;
  // pendingCanPlay lives on previewAudio.
  private pendingCanPlay: (() => void) | null = null;
  private pendingSeeked: (() => void) | null = null;
  private goToSeekTimer: number | null = null;

  // The element currently in use, resolved from `mode`. Reads and property-sets (e.g.
  // `this.audio.currentTime = x`) act on the active element; the HLS lifecycle methods use
  // `this.hlsAudio` explicitly and the preview path uses `this.previewAudio` explicitly.
  private get audio(): HTMLAudioElement {
    return this.mode === 'preview' ? this.previewAudio : this.hlsAudio;
  }

  constructor() {
    this.hlsAudio = new Audio();
    this.hlsAudio.preload = 'auto';
    this.hlsAudio.crossOrigin = 'anonymous'; // peaks / Web-Audio need CORS on the HLS element

    this.previewAudio = new Audio();
    this.previewAudio.preload = 'auto'; // Apple preview CDN — deliberately no crossOrigin

    // volume sync once per controller lifetime — applied to BOTH elements
    let lastVolume = usePlayerStore.getState().volume;
    this.hlsAudio.volume = lastVolume;
    this.previewAudio.volume = lastVolume;
    this.volumeUnsubscribe = usePlayerStore.subscribe(() => {
      const volume = usePlayerStore.getState().volume;
      if (volume !== lastVolume) {
        lastVolume = volume;
        this.hlsAudio.volume = volume;
        this.previewAudio.volume = volume;
      }
    });

    // media hiccup watcher — only the HLS element needs the retry machinery (Apple previews recover
    // on their own; onMediaHiccup also early-returns in preview mode).
    ['stalled','suspend','waiting','emptied','error','abort'].forEach((ev) => {
      this.hlsAudio.addEventListener(ev, this.onMediaHiccup);
    });

    // global visibility/focus signals
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pageshow', this.onPageShow);
    window.addEventListener('focus', this.onWindowFocus);

    this.wireGlobalOnlineOffline();
    // Bind the core <audio> events (timeupdate/ended/canplay/…) to BOTH elements up-front. Each
    // handler acts only when its element is the active one. Idempotent (wiredAudioEvents guard).
    this.wireAudioEvents();
  }

  // =============== Public API ===============

  load = (trackId: string, isPlayAfter: boolean = false) => {
    if (DEMO_MODE) return;
    const seq = ++this.loadSeq;
    this.clearNetworkError();
    this.clearRetry();
    // Fresh load intent — tear down any one-shot handler from the previous track/mode and clear a
    // possibly-stuck seek flag, so the new track starts from a clean state.
    this.clearOneShotHandlers();
    this.resetSeekState();

    if (!this.tracks.length) this.initPlaylist();

    // Catalogue tracks play from their Apple Music preview URL on the dedicated previewAudio element.
    const track = this.resolveTrack(trackId);
    if (track && track.playback === 'preview' && track.preview_url) {
      this.loadPreview(track, isPlayAfter);
      return;
    }
    this.mode = 'hls';
    // Switching to the seed: make sure the preview element is silent so both never play at once.
    try { this.previewAudio.pause(); } catch { /* noop */ }

    if (!navigator.onLine) {
      this.scheduleColdRetry('offline');
    }

    const continueLoading = () => {
      if (seq !== this.loadSeq) return; // superseded by a newer load/preview
      // Resume the HLS loader if we had stopped it while a preview was playing (hls is kept alive).
      if (this.hls && this.isPlaylistLoaded) {
        try { this.hls.startLoad(this.hlsAudio.currentTime || -1); } catch { /* noop */ }
      }

      if (isPlayAfter) {
        this.wantPlaying = true;
        this.msInitSession(trackId);
        this.selectCurrent(trackId);
        usePlayerStore.getState().setIsPlaying(true);
      }
      this.playAfterLoad = isPlayAfter;

      // Remove any pending loadedmetadata handler to prevent stacking
      if (this.pendingOnReady) {
        this.hlsAudio.removeEventListener('loadedmetadata', this.pendingOnReady);
        this.pendingOnReady = null;
      }

      const onReady = () => {
        this.hlsAudio.removeEventListener('loadedmetadata', onReady);
        this.pendingOnReady = null;
        if (seq !== this.loadSeq) return;
        this.goToTrack(trackId, this.playAfterLoad, true);
        this.playAfterLoad = false;
      };

      if (this.hlsAudio.readyState >= 1) {
        this.goToTrack(trackId, isPlayAfter, true);
      } else {
        this.pendingOnReady = onReady;
        this.hlsAudio.addEventListener('loadedmetadata', onReady);
      }
    };

    if (!this.isPlaylistLoaded) {
      this.ensureHlsLoaded().then(() => { if (seq === this.loadSeq) continueLoading(); }).catch(() => {});
    } else {
      continueLoading();
    }
  };

  play = () => {
    if (DEMO_MODE) return;
    if (!this.currentTrackId && this.tracksIds.length) {
      this.wantPlaying = true;
      this.load(this.tracksIds[0], true);
      return;
    }
    this.msInitSession(this.currentTrackId || null);
    this.wantPlaying = true;
    usePlayerStore.getState().setIsPlaying(true);
    msSetPlaybackState('playing');
    if (this.mode === 'preview') {
      this.previewAudio.play().catch(() => { /* autoplay policy — user can press play */ });
      return;
    }
    // Resume the HLS loader if it was paused while a preview played.
    if (this.hls && this.isPlaylistLoaded) {
      try { this.hls.startLoad(this.hlsAudio.currentTime || -1); } catch { /* noop */ }
    }
    this.playWhenBuffered().catch(() => this.scheduleRetry());
  };

  pause = () => {
    this.wantPlaying = false;
    this.clearRetry();
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('paused');
    // Pause both engines defensively so nothing can keep playing in the background.
    try { this.hlsAudio.pause(); } catch { /* noop */ }
    try { this.previewAudio.pause(); } catch { /* noop */ }
  };

  stop = () => {
    this.wantPlaying = false;
    this.clearRetry();
    this.clearNetworkError();
    usePlayerStore.getState().setIsPlaying(false);
    msSetPlaybackState('none');
    try { this.hlsAudio.pause(); } catch { /* noop */ }
    try { this.previewAudio.pause(); } catch { /* noop */ }
  };

  seek = (seconds: number, trackId?: string) => {
    if (DEMO_MODE) return;
    const id = trackId || this.currentTrackId;
    if (!id) return;

    // Preview: the <audio> holds only this track, so `seconds` maps straight to currentTime
    // (clamped to the preview's own length — which is what the scrubber spans).
    if (this.mode === 'preview') {
      const dur = this.previewAudio.duration || 0;
      const clamped = dur ? Math.max(0, Math.min(seconds, dur)) : Math.max(0, seconds);
      this.previewAudio.currentTime = clamped;
      usePlayerStore.getState().setTrackTime(id, clamped);
      usePlayerStore.setState({ inputCurrentTime: clamped });
      return;
    }

    const startOffset = this.offsets.get(id) || 0;
    const d = this.durations.get(id) || 0;
    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[id] : null;

    // seconds is the absolute time in the original file (0 to original_duration)
    // We want to map this to the audible snippet range
    const audibleStart = snippet ? snippet.start : 0;

    // Position within the snippet (0 to snippetDuration)
    const localAudibleOffset = Math.min(Math.max(0, seconds - audibleStart), d);
    const audioTargetTime = startOffset + localAudibleOffset;

    this.hlsAudio.currentTime = audioTargetTime;
    usePlayerStore.getState().setTrackTime(id, seconds);

    if (this.isMediaSessionInit) {
      msUpdatePositionState({
        position: seconds,
        duration: d,
        playbackRate: this.hlsAudio.paused ? 0 : 1
      }, true);
    }
    usePlayerStore.setState({ inputCurrentTime: seconds });
  };

  unload = () => {
    this.wantPlaying = false;
    this.clearRetry();
    this.clearColdRetry();
    this.clearNetworkError();
    try { this.hlsAudio.pause(); } catch { /* noop */ }
    try { this.previewAudio.pause(); } catch { /* noop */ }

    if (this.hls) {
      try { this.hls.destroy(); } catch { /* noop */ }
      this.hls = null;
    }

    this.hlsAudio.removeAttribute('src');
    this.hlsAudio.load();
    this.previewAudio.removeAttribute('src');
    this.previewAudio.load();

    this.isPlaylistLoaded = false;
    this.currentTrackId = null;
    this.tracks = [];
    this.tracksIds = [];
    this.offsets.clear();
    this.durations.clear();
    this.totalDuration = 0;

    // Clear stale snippet metadata so the next upload starts clean
    usePlayerStore.setState({ snippetMetadata: {} });

    msReset();
    usePlayerStore.setState({ isLoaded: false });
  };

  getCurrentTime = () => {
    if (!this.currentTrackId) return 0;
    if (this.mode === 'preview') return this.previewAudio.currentTime || 0;
    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[this.currentTrackId] : null;
    const audioOffset = this.offsets.get(this.currentTrackId) || 0;

    // (audio.currentTime - audioOffset) is the time relative to the snippet start in the manifest (0..snipDur)
    // We add snippet.start to get the absolute time in the original file (audibleStart..audibleEnd)
    return (this.hlsAudio.currentTime - audioOffset) + (snippet ? snippet.start : 0);
  };

  getDuration = () => {
    if (!this.currentTrackId) return 0;
    // Preview: the scrubber spans the preview's OWN length (not the full track); the full length is
    // shown separately as metadata.
    if (this.mode === 'preview') return this.previewAudio.duration || 0;
    return this.durations.get(this.currentTrackId) || 0;
  };

  get isLoaded() {
    return !!(this.audio.readyState >= 1);
  }

  // =============== Private: preview (Apple Music) playback ===============

  private resolveTrack(trackId: string): Track | undefined {
    const data = usePlaylistStore.getState().playlistData;
    if (!data) return undefined;
    if (data.queried_track?.id === trackId) return data.queried_track;
    return data.similar_tracks?.find((t) => t.id === trackId);
  }

  // Play a catalogue track from its Apple Music preview_url on the dedicated previewAudio element.
  // The HLS engine is KEPT ALIVE (attached + loaded) — we only pause the seed element and stop its
  // segment loading — so returning to the seed is instant (no session re-fetch, no re-attach) and we
  // never destroy/recreate hls per switch. No crossOrigin toggling (previewAudio never sets it).
  private loadPreview(track: Track, isPlayAfter: boolean) {
    const seq = ++this.loadSeq;
    this.mode = 'preview';
    this.clearRetry();
    this.clearColdRetry();
    this.clearNetworkError();

    try { this.hlsAudio.pause(); } catch { /* noop */ }
    try { this.hls?.stopLoad(); } catch { /* noop */ }

    // Drop any one-shot handler and clear a possibly-stuck seek flag.
    this.clearOneShotHandlers();
    this.resetSeekState();

    this.currentTrackId = track.id;
    this.wantPlaying = isPlayAfter;
    this.msInitSession(track.id);
    this.selectCurrent(track.id);
    if (isPlayAfter) usePlayerStore.getState().setIsPlaying(true);

    this.previewAudio.src = track.preview_url as string;
    this.previewAudio.load();

    const onCanPlay = () => {
      this.previewAudio.removeEventListener('canplay', onCanPlay);
      this.pendingCanPlay = null;
      if (seq !== this.loadSeq) return;
      if (this.wantPlaying) {
        msSetPlaybackState('playing');
        this.previewAudio.play().catch(() => { /* autoplay policy — user can press play */ });
      }
    };
    this.pendingCanPlay = onCanPlay;
    this.previewAudio.addEventListener('canplay', onCanPlay);
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

    // Fast-track snippet detection for uploads by loading the manifest immediately
    if (playlistData.queried_track?.type === 'upload' && this.playlistUrl) {
      this.ensureHlsLoaded();
    }
  }

  private buildTimeline() {
    this.offsets = new Map();
    this.durations = new Map();

    let acc = 0;
    this.tracks.forEach((t, i) => {
      const meta = usePlayerStore.getState().snippetMetadata;
      const snippet = meta ? meta[t.id] : null;
      const d = snippet ? (snippet.end - snippet.start) : Math.max(0, Number(t.duration) || 0);

      this.offsets.set(t.id, acc);
      this.durations.set(t.id, d);
      acc += d;
      if (i < this.tracks.length - 1) acc += GAP_BETWEEN_TRACKS;
    });

    this.totalDuration = acc;
  }

  private getSavedLocalTime(trackId: string) {
    const d = this.durations.get(trackId) || 0;
    const saved = usePlayerStore.getState().getTrackTime(trackId);

    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[trackId] : null;

    // If never played before, start at the snippet's audible start
    const effectiveSaved = (saved === undefined || saved === 0) && snippet ? snippet.start : (saved || 0);

    const max = d > 0.25 ? d - 0.25 : d;
    // We clamp to the absolute range (snippet.start to snippet.end)
    const audibleStart = snippet ? snippet.start : 0;
    const audibleEnd = snippet ? snippet.end : d;

    return Math.min(Math.max(audibleStart, effectiveSaved), audibleEnd);
  }

  // =============== Private: HLS lifecycle ===============

  private async ensureHlsLoaded() {
    if (this.isPlaylistLoaded) return;
    if (!this.tracks.length) this.initPlaylist();
    if (!this.tracksIds.length) return;

    try {
      await this.fetchPlaybackSession();
    } catch (e) {
      console.error("[HLS] Failed to pre-flight playlist session", e);
      // Deferred + play-gated: a failure during the passive pre-load never flashes the badge.
      this.flagNetworkError("session-failed");
      return;
    }

    if (Hls.isSupported()) {
      const urlObj = new URL(this.playlistUrl);
      const token = urlObj.searchParams.get("token");

      const bserverHostname = new URL(API_CONFIG.BASE_URL).hostname;

      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
        xhrSetup: function (xhr, url) {
          let finalUrl = url;
          const requestUrl = new URL(url);
          const isLocal = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
          const mediaHostname = API_CONFIG.MEDIA_URL ? new URL(API_CONFIG.MEDIA_URL).hostname : '';
          const isInternal = requestUrl.hostname === bserverHostname || requestUrl.hostname === mediaHostname || isLocal;

          if (token && (requestUrl.hostname === urlObj.hostname || isLocal)) {
            if (!finalUrl.includes('token=')) {
              const sep = finalUrl.includes('?') ? '&' : '?';
              finalUrl += sep + 'token=' + token;
            }
          }

          if (finalUrl !== url) {
            xhr.open('GET', finalUrl, true);
          }
        }
      });
      this.hls.loadSource(this.playlistUrl);
      this.hls.attachMedia(this.hlsAudio);
      this.wireHlsErrorHandlers();
      try { this.hls.startLoad(-1); } catch { /* noop */ }
    } else {
      // Safari / native HLS
      this.hlsAudio.src = this.playlistUrl;
      this.hlsAudio.load();
    }

    this.wireAudioEvents();
    this.isPlaylistLoaded = true;

    if (!navigator.onLine) {
      this.scheduleColdRetry('offline');
    }
  }

  private async restartHls() {
    if (!this.playlistUrl) return;

    // Rate-limit restarts to prevent infinite loops — BUT never drop a restart when the engine is
    // actually gone (this.hls === null), since that's exactly when recovery is required.
    const now = Date.now();
    if (this.hls && now - this.lastRestartTime < 2000) {
      console.warn("[HLS] Restart requested too soon, skipping to avoid infinite loop.");
      return;
    }
    this.lastRestartTime = now;

    if (this.hls) {
      try { this.hls.destroy(); } catch { /* noop */ }
      this.hls = null;
    }

    try {
      await this.fetchPlaybackSession();
    } catch (e) {
      console.error("[HLS] Failed to refresh playlist session", e);
      return;
    }

    if (Hls.isSupported()) {
      const urlObj = new URL(this.playlistUrl);
      const token = urlObj.searchParams.get("token");

      const bserverHostname = new URL(API_CONFIG.BASE_URL).hostname;

      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
        xhrSetup: function (xhr, url) {
          let finalUrl = url;
          const requestUrl = new URL(url);
          const isLocal = requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1';
          const mediaHostname = API_CONFIG.MEDIA_URL ? new URL(API_CONFIG.MEDIA_URL).hostname : '';
          const isInternal = requestUrl.hostname === bserverHostname || requestUrl.hostname === mediaHostname || isLocal;

          if (token && (requestUrl.hostname === urlObj.hostname || isLocal)) {
            if (!finalUrl.includes('token=')) {
              const sep = finalUrl.includes('?') ? '&' : '?';
              finalUrl += sep + 'token=' + token;
            }
          }

          if (finalUrl !== url) {
            xhr.open('GET', finalUrl, true);
          }
        }
      });
      this.hls.attachMedia(this.hlsAudio);
      this.hls.loadSource(this.playlistUrl);
      this.wireHlsErrorHandlers();
    }

    return this.hls;
  }

  // =============== Private: events ===============

  private wireAudioEvents() {
    if (this.wiredAudioEvents) return;
    this.wiredAudioEvents = true;
    this.bindAudioEvents(this.hlsAudio);
    this.bindAudioEvents(this.previewAudio);
  }

  // Bind the shared media events to one element. Every handler acts ONLY when that element is the
  // currently-active one (`el === this.audio`), so an event from the paused/inactive element (e.g. a
  // stray 'seeked'/'canplay' during a switch) can never mutate playback state for the other engine.
  private bindAudioEvents(el: HTMLAudioElement) {
    const active = () => el === this.audio;

    el.addEventListener('play', () => { if (active()) msSetPlaybackState('playing'); });
    el.addEventListener('pause', () => { /* keep silent */ });

    const onReadyish = () => {
      if (!active()) return;
      this.clearNetworkError();
      this.clearColdRetry();
      this.clearRetry();
    };
    el.addEventListener('canplaythrough', onReadyish);
    el.addEventListener('canplay', onReadyish);
    el.addEventListener('playing', onReadyish);

    el.addEventListener('seeking', () => {
      if (!active()) return;
      this.isSeeking = true;
      this.startSeekGrace(1200);
    });
    el.addEventListener('seeked', () => {
      if (!active()) return;
      this.isSeeking = false;
      this.startSeekGrace(800);
    });

    el.addEventListener('ended', () => {
      if (!active()) return;
      // The uploaded reference track (HLS seed) is its OWN <audio>. When it plays fully to the end,
      // park its SAVED position back at the audible start so replaying it later starts fresh —
      // otherwise it stays parked at the end and 'ends' again the instant you press play, jumping
      // straight to the next track. Only the HLS seed needs this (preview members reload their src
      // from scratch each time, so they already replay correctly), hence the mode guard.
      if (this.mode === 'hls' && this.currentTrackId) {
        const meta = usePlayerStore.getState().snippetMetadata;
        const snippet = meta ? meta[this.currentTrackId] : null;
        usePlayerStore.getState().setTrackTime(this.currentTrackId, snippet ? snippet.start : 0);
      }
      // Advance the queue on autoplay — seed → member1 → member2 …, regardless of engine.
      const nextId = this.getNextTrackId();
      if (usePlayerStore.getState().autoplay && nextId) {
        this.load(nextId, true);
        return;
      }
      this.wantPlaying = false;
      this.clearRetry();
      msSetPlaybackState('none');
      usePlayerStore.getState().setIsPlaying(false);
      usePlayerStore.getState().setCurrentTrack(null);
    });

    el.addEventListener('timeupdate', this.onTimeUpdate);
  }

  private wireGlobalOnlineOffline() {
    if (this.wiredGlobalEvents) return;
    this.wiredGlobalEvents = true;

    window.addEventListener('online', () => {
      this.clearNetworkError();
      this.attemptResume(true, true);
    });
    window.addEventListener('offline', () => {
      // A genuine connectivity loss is a clear, real signal — surface it immediately.
      this.flagNetworkError('offline', true);
      this.scheduleRetry();
    });
  }

  private async fetchPlaybackSession() {
    if (this.sessionPromise) return this.sessionPromise;

    this.sessionPromise = getPlaylistPlaybackSession(this.playlistId);
    try {
      const response = await this.sessionPromise;
      this.playlistUrl = this.updatePlaylistUrlWithAuth(response.playback_url);
      return response;
    } catch (e) {
      this.playlistUrl = ''; // invalidate
      throw e;
    } finally {
      this.sessionPromise = null;
    }
  }

  private updatePlaylistUrlWithAuth(rawUrl: string): string {
    // Playback auth is carried by the `token` (edge JWT) already present in the play-session URL.
    // The retired static api_key is no longer appended.
    return rawUrl;
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
        if (code === 410) return false; // Treat 410 as special, not a retriable serious error
        if (typeof code === 'number' && code >= 400) return true;
      }
      return false;
    };

    this.hls.on(Hls.Events.ERROR, (_e, data) => {
      if (isAbortError(data)) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        const responseLevel = data.response as any;
        const code = responseLevel?.code ?? responseLevel?.status;

        // --- Edge Authorization Token Expiration Handling (403) ---
        if (code === 403) {
          // eslint-disable-next-line no-console
          console.warn("[HLS] Token expired (403). Refreshing Edge Auth session...");
          const savedTime = this.hlsAudio.currentTime;

          getPlaylistPlaybackSession(this.playlistId).then((res) => {
            this.playlistUrl = res.playback_url;
            this.restartHls().then(() => {
              this.hlsAudio.currentTime = savedTime;
              if (this.wantPlaying && this.mode === 'hls') {
                this.hlsAudio.play().catch(() => { /* noop */ });
              }
            });
          }).catch((err) => {
            console.error("[HLS] Failed to refresh token", err);
            this.flagNetworkError('403-refresh-failed');
          });

          return; // Prevent standard error/retry logic
        }
        // ----------------------------------------------------------

        if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR && code === 410) {
          const queriedTrack = usePlaylistStore.getState().playlistData?.queried_track;
          if (queriedTrack?.id) {
            usePlayerStore.getState().setTrackDeleted(queriedTrack.id, true);
            this.pause();
            setNetworkErrorFlag(true, '410-gone');
          }
          return;
        }

        if (isSeriousNetworkError(data)) {
          // offline → immediate; otherwise deferred + play-gated (transient buffering won't flash).
          this.flagNetworkError(data?.details || (navigator.onLine ? 'network-error' : 'offline'), !navigator.onLine);
          if (this.wantPlaying) {
            this.scheduleRetry(true, data?.details);
          } else {
            this.scheduleColdRetry(data?.details);
          }
        } else {
          this.attemptResume(true, !this.wantPlaying /* allowCold if not playing */);
        }
        return;
      }

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.MEDIA_ERROR:
            try { this.hls?.recoverMediaError(); } catch {}
            break;
          default:
            this.flagNetworkError('fatal-error');
            this.restartHls().then(() => {
              if (this.wantPlaying) {
                this.scheduleRetry(true, 'fatal-error');
              } else {
                this.scheduleColdRetry('fatal-error');
              }
            });
            break;
        }
      }
    });

    this.hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
      const queriedTrack = usePlaylistStore.getState().playlistData?.queried_track;
      if (!queriedTrack || queriedTrack.type !== 'upload') return;

      const frags = data.details.fragments;
      if (!frags.length) return;

      // Intercept the "uuid=deleted" 0.000s discontinuity stub generated by backend
      const firstFragUrl = frags[0].url || '';
      const firstFragRelUrl = frags[0].relurl || '';

      if (firstFragUrl.includes('uuid=deleted') || firstFragRelUrl.includes('uuid=deleted')) {
        usePlayerStore.getState().setTrackDeleted(queriedTrack.id, true);
        this.pause();
        setNetworkErrorFlag(true, '410-gone');
        return;
      }

      // Only detect snippet once per track — LEVEL_LOADED fires on every level refresh
      const existingMeta = usePlayerStore.getState().snippetMetadata[queriedTrack.id];
      if (existingMeta) return;

      // Segments before the first discontinuity belong to the first track (the uploaded snippet)
      const firstCC = frags[0].cc;
      let totalCCDuration = 0;
      let lastFragDuration = 0;
      let ccFragCount = 0;

      for (const f of frags) {
        if (f.cc !== firstCC) break;
        totalCCDuration += f.duration;
        lastFragDuration = f.duration;
        ccFragCount++;
      }

      // If the last fragment in the first CC is roughly 2s (and we have other segments),
      // it's likely the silent gap. We exclude it from the audible snippet duration
      // so it can be handled as a GAP_BETWEEN_TRACKS by the controller timeline.
      let snippetDuration = totalCCDuration;
      if (ccFragCount > 1 && Math.abs(lastFragDuration - 2.0) < 0.5) {
        snippetDuration -= lastFragDuration;
      }

      // Detect snippet start from the first segment's index
      const firstSN = frags[0].sn;
      let snippetStart = firstSN * 6; // Default assumption

      // Try to parse index from filename if it looks like segment_123.ts or index123.ts or similar
      const url = frags[0].url || '';
      const relUrl = frags[0].relurl || '';

      // The segment number is at the end: ...&seg=0 or ...?seg=0
      // We also fallback to common patterns like segment_20 or index20
      const match = url.match(/[?&]seg=(\d+)/i) ||
                   relUrl.match(/[?&]seg=(\d+)/i) ||
                   url.match(/(?:segment|index)[_-]?(\d+)/i) ||
                   relUrl.match(/(?:segment|index)[_-]?(\d+)/i);

      if (match) {
        const segIdx = parseInt(match[1], 10);
        // If SN is 0 but we found a segment number in the filename/url, trust it
        if (snippetStart === 0 || firstSN === 0) {
          snippetStart = segIdx * 6;
        }
      }

      console.log(`[HLS] Detected snippet for ${queriedTrack.id}: start=${snippetStart}s, end=${snippetStart + snippetDuration}s (sn: ${firstSN}, cc: ${firstCC}, totalCC: ${totalCCDuration}s)`);

      usePlayerStore.getState().setSnippetMetadata(queriedTrack.id, {
        start: snippetStart,
        end: snippetStart + snippetDuration,
      });

      // Update initial position if never played
      const storedTime = usePlayerStore.getState().getTrackTime(queriedTrack.id);
      if (storedTime === undefined || storedTime === 0) {
        usePlayerStore.getState().setTrackTime(queriedTrack.id, snippetStart);
      }

      // Re-build timeline if metadata changed
      this.buildTimeline();
    });

    const clear = () => {
      this.clearRetry();
      this.clearColdRetry();
    };
    this.hls.on(Hls.Events.MANIFEST_PARSED, clear);
    this.hls.on(Hls.Events.LEVEL_LOADED, clear);
    this.hls.on(Hls.Events.FRAG_LOADED, clear);
  }

  // =============== Private: resume/retry ===============

  private attemptResume = async (immediate = false, allowCold = false) => {
    if (this.mode === 'preview') return;  // previews are a plain <audio> — no HLS resume machinery
    if (!allowCold && !this.wantPlaying) return;
    if (!navigator.onLine) return;

    if (!this.isPlaylistLoaded) {
      await this.ensureHlsLoaded();
    }

    if (Hls.isSupported()) {
      const t = this.hlsAudio.currentTime || 0;

      if (!this.hls) {
        await this.restartHls();
        try {
          const hlsInstance = this.hls as Hls | null;
          if (hlsInstance && typeof hlsInstance.startLoad === 'function') {
            hlsInstance.startLoad(t || -1);
          }
        } catch { /* noop */ }
      } else {
        const bufAhead = this.getBufferedAhead();
        const isStalled = this.hlsAudio.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || bufAhead < 0.25;

        try { if (isStalled) this.hls.stopLoad(); } catch { /* noop */ }
        try {
          this.hls.startLoad(this.hlsAudio.currentTime || -1);
        } catch {
          await this.restartHls();
          try { this.hls?.startLoad(this.hlsAudio.currentTime || -1); } catch { /* noop */ }
        }
      }

      if (immediate && this.wantPlaying) {
        this.playWhenBuffered().catch(() => { /* retry timer and hiccup handler backstop */ });
      }
    } else {
      // Safari / native HLS
      const t = this.hlsAudio.currentTime || 0;
      const wasPlaying = this.wantPlaying;
      this.hlsAudio.src = this.playlistUrl + (this.playlistUrl.includes('?') ? '&' : '?') + 'r=' + Date.now();
      this.hlsAudio.load();
      this.hlsAudio.currentTime = t;
      if (wasPlaying) this.playWhenBuffered().catch(() => {});
    }
  }

  private scheduleRetry(showFlag = false, reason?: string) {
    if (!this.wantPlaying) return;
    if (this.retryTimer !== null) return;
    if (showFlag) {
      this.flagNetworkError(reason || (navigator.onLine ? 'retrying' : 'offline'), !navigator.onLine);
    }
    this.attemptResume(true);
    this.retryTimer = window.setInterval(() => {
      this.attemptResume(false);
    }, RETRY_EVERY);
  }

  private scheduleColdRetry(reason?: string) {
    if (this.coldRetryTimer !== null) return;
    this.flagNetworkError(reason || (navigator.onLine ? 'retrying' : 'offline'), !navigator.onLine);
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
    this.clearNetworkError();
  }

  // =============== Private: network-error surfacing (deferred + play-gated) ===============

  // Only surface the "Network" badge for a problem the user can actually perceive: it must PERSIST
  // for NET_ERROR_GRACE_MS AND the user must actually want playback. Passive pre-loads (rendering the
  // reference waveform on refresh) and short buffering blips therefore never flash the badge.
  // `immediate` bypasses the grace for genuinely clear signals (a real 'offline' event).
  private flagNetworkError(reason?: string, immediate = false) {
    if (DEMO_MODE) return;
    if (immediate) {
      if (this.netErrTimer !== null) { clearTimeout(this.netErrTimer); this.netErrTimer = null; }
      setNetworkErrorFlag(true, reason);
      return;
    }
    if (!this.wantPlaying) return;             // suppress during passive / initial load
    if (this.netErrTimer !== null) return;     // already armed
    this.netErrTimer = window.setTimeout(() => {
      this.netErrTimer = null;
      if (this.wantPlaying) setNetworkErrorFlag(true, reason);
    }, NET_ERROR_GRACE_MS);
  }

  private clearNetworkError() {
    if (this.netErrTimer !== null) { clearTimeout(this.netErrTimer); this.netErrTimer = null; }
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
    const t = this.hlsAudio.currentTime || 0;
    const buf = this.hlsAudio.buffered;
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

      const el = this.hlsAudio;

      const tryPlay = () => {
        // Abort if the user paused OR switched to a preview meanwhile — otherwise a seed buffer that
        // fills AFTER the user tapped a catalogue track would start the seed on top of the preview
        // (two elements can both play). The mode guard is what keeps exactly one engine audible.
        if (!this.wantPlaying || this.mode !== 'hls') {
          cleanup();
          return resolve();
        }
        const ahead = this.getBufferedAhead();
        if (ahead >= minSec) {
          cleanup();
          el.play().then(resolve).catch(reject);
        }
      };

      const onProgress = () => tryPlay();
      const onTimeUpdate = () => tryPlay();
      const onCanPlay = () => tryPlay();
      const onCanPlayThrough = () => tryPlay();
      const onBufferAppended = () => tryPlay();

      const cleanup = () => {
        el.removeEventListener('progress', onProgress);
        el.removeEventListener('timeupdate', onTimeUpdate);
        el.removeEventListener('canplay', onCanPlay);
        el.removeEventListener('canplaythrough', onCanPlayThrough);
        try { this.hls?.off(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch { /* noop */ }
        if (timer) clearTimeout(timer);
      };

      const timer = window.setTimeout(() => {
        cleanup();
        // Same guard as tryPlay: never force the seed to play if we've paused or switched to preview.
        if (!this.wantPlaying || this.mode !== 'hls') return resolve();
        el.play().then(resolve).catch(reject);
      }, PLAY_FALLBACK_AFTER_MS);

      el.addEventListener('progress', onProgress);
      el.addEventListener('timeupdate', onTimeUpdate);
      el.addEventListener('canplay', onCanPlay);
      el.addEventListener('canplaythrough', onCanPlayThrough);
      try { this.hls?.on(Hls.Events.BUFFER_APPENDED as any, onBufferAppended as any); } catch { /* noop */ }

      tryPlay();
    });
  }

  private goToTrack(trackId: string, autoplay = false, preRollOnZero = false) {
    // The HLS <audio> stream holds ONLY the upload seed. A preview member must never be reached by
    // seeking this stream — hand it to the preview loader instead (also covers media-session next/prev).
    const targetTrack = this.resolveTrack(trackId);
    if (targetTrack && targetTrack.playback === 'preview' && targetTrack.preview_url) {
      this.loadPreview(targetTrack, autoplay);
      return;
    }

    if (!this.isPlaylistLoaded) this.ensureHlsLoaded();
    if (!this.tracksIds.length) return;

    const startOffset = this.offsets.get(trackId) || 0;
    const d = this.durations.get(trackId) || 0;
    const savedLocal = this.getSavedLocalTime(trackId);

    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[trackId] : null;
    const audibleStart = snippet ? snippet.start : 0;

    // Position relative to manifest start (0..snipDur)
    const localAudibleOffset = Math.max(0, savedLocal - audibleStart);
    let target = startOffset + localAudibleOffset;

    if (preRollOnZero && localAudibleOffset === 0) {
      target = Math.max(0, startOffset - AUTOSWITCH_PREROLL);
    }

    this.selectCurrent(trackId);

    const shouldPlay = autoplay;
    if (shouldPlay) {
      this.wantPlaying = true; // start offline retries before play
    }

    // Arm a fresh seek completion path; clear any prior one so it can't double-fire.
    if (this.pendingSeeked) {
      this.hlsAudio.removeEventListener('seeked', this.pendingSeeked);
      this.pendingSeeked = null;
    }
    if (this.goToSeekTimer !== null) {
      clearTimeout(this.goToSeekTimer);
      this.goToSeekTimer = null;
    }

    const finishSeek = () => {
      if (this.pendingSeeked) {
        this.hlsAudio.removeEventListener('seeked', this.pendingSeeked);
        this.pendingSeeked = null;
      }
      if (this.goToSeekTimer !== null) {
        clearTimeout(this.goToSeekTimer);
        this.goToSeekTimer = null;
      }
      this.isSeeking = false;

      if (!Hls.isSupported()) {
        try {
          this.hlsAudio.currentTime = this.hlsAudio.currentTime + 0.001;
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

    this.isSeeking = true;
    if (Hls.isSupported()) {
      this.hlsAudio.pause();
    }

    // If the target is essentially where we already are, no 'seeking'/'seeked' pair fires — run the
    // completion path directly so isSeeking can't stick true and freeze onTimeUpdate.
    const needsSeek = Math.abs((this.hlsAudio.currentTime || 0) - target) > 0.05;
    if (!needsSeek) {
      finishSeek();
      return;
    }

    const onSeeked = () => finishSeek();
    this.pendingSeeked = onSeeked;
    this.hlsAudio.addEventListener('seeked', onSeeked);
    // Safety net: a browser may not emit 'seeked' if the target range isn't buffered yet — force the
    // completion path after a short delay so a missed event can't leave us stuck seeking.
    this.goToSeekTimer = window.setTimeout(finishSeek, 1500);
    this.hlsAudio.currentTime = target;
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

  private onTimeUpdate = (e?: Event) => {
    // Ignore a timeupdate from the paused/inactive element (the other engine mid-switch).
    if (e && e.target !== this.audio) return;
    if (!this.currentTrackId || this.isSeeking) return;

    // Preview: the <audio> holds a single track, so time is reported straight through (no global
    // offset map, no cross-track advance — the queue advances on the 'ended' event).
    if (this.mode === 'preview') {
      const t = this.previewAudio.currentTime || 0;
      usePlayerStore.setState({ inputCurrentTime: t });
      usePlayerStore.getState().setTrackTime(this.currentTrackId, t);
      if (this.isMediaSessionInit) {
        msUpdatePositionState(
          { position: t, duration: this.previewAudio.duration || 0, playbackRate: this.previewAudio.paused ? 0 : 1 },
          false,
        );
      }
      return;
    }

    const globalT = this.hlsAudio.currentTime || 0;
    const startOffset = this.offsets.get(this.currentTrackId) || 0;
    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[this.currentTrackId] : null;

    // (globalT - startOffset) is position in snippet (0..snipDur)
    // Adding snippet.start gives us the absolute time in the original file
    const localT = Math.max(0, globalT - startOffset + (snippet ? snippet.start : 0));

    usePlayerStore.setState({ inputCurrentTime: localT });
    usePlayerStore.getState().setTrackTime(this.currentTrackId, localT);

    msUpdatePositionState({
      position: localT,
      duration: this.durations.get(this.currentTrackId) || 0,
      playbackRate: this.hlsAudio.paused ? 0 : 1
    }, false);

    const newId = this.findTrackByGlobalTime(globalT);
    if (newId && newId !== this.currentTrackId) {
      // The HLS <audio> holds ONLY the upload seed (backend manifest is seed-only), so globalT never
      // truly crosses into a member's slot during normal playback. Cross-track advance to a preview
      // happens on the real `ended` event → load()/loadPreview(). Only advance in-stream if the next
      // track is itself HLS (kept for a hypothetical multi-upload manifest; never today).
      const nextTrack = this.resolveTrack(newId);
      if (nextTrack && nextTrack.playback === 'hls') {
        usePlayerStore.getState().setTrackTime(this.currentTrackId, 0);
        const { autoplay } = usePlayerStore.getState();
        if (autoplay) {
          const shouldAutoplay = !this.hlsAudio.paused;
          this.goToTrack(newId, shouldAutoplay, true);
          this.wantPlaying = true;
        } else {
          this.pause();
          this.seek(0, this.currentTrackId);
        }
      }
    }
  };

  private onMediaHiccup = (_evt: Event) => {
    if (this.mode === 'preview') return;  // Apple CDN previews recover on their own; no HLS retry
    if (!this.wantPlaying) return;
    if (this.isSeeking || this.inSeekGrace()) return;

    if (!navigator.onLine) {
      this.flagNetworkError('offline', true);
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

  // =============== Private: transition cleanup ===============

  // Tear down every one-shot listener/timer we may have armed for the previous track/mode, so nothing
  // queued for a superseded source fires against the new one. pendingOnReady/pendingSeeked live on
  // hlsAudio; pendingCanPlay on previewAudio.
  private clearOneShotHandlers() {
    if (this.pendingOnReady) {
      this.hlsAudio.removeEventListener('loadedmetadata', this.pendingOnReady);
      this.pendingOnReady = null;
    }
    if (this.pendingCanPlay) {
      this.previewAudio.removeEventListener('canplay', this.pendingCanPlay);
      this.pendingCanPlay = null;
    }
    if (this.pendingSeeked) {
      this.hlsAudio.removeEventListener('seeked', this.pendingSeeked);
      this.pendingSeeked = null;
    }
    if (this.goToSeekTimer !== null) {
      clearTimeout(this.goToSeekTimer);
      this.goToSeekTimer = null;
    }
  }

  // isSeeking gates onTimeUpdate (progress + advance). If a 'seeked' event never arrives (a no-op
  // seek, or a source swap mid-seek), the flag would stick true and freeze the UI until a refresh.
  // Reset it (and the seek grace window) on every fresh load so a new track starts clean.
  private resetSeekState() {
    this.isSeeking = false;
    this.seekGraceUntil = 0;
  }
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
