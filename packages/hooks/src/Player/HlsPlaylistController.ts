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
import { getPlaylistPlaybackSession } from "@resomix/api-client";
import {DEMO_MODE} from "@resomix/config";

// ================== Config ==================
const RETRY_EVERY = 8000;
const GAP_BETWEEN_TRACKS = 2.005; // sec silent segment
const AUTOSWITCH_PREROLL = 0.5;   // sec preroll between new track start
const MIN_BUFFER_BEFORE_PLAY = 3; // sec in buffer before play
const PLAY_FALLBACK_AFTER_MS = 3000;

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
  private pendingOnReady: (() => void) | null = null;

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
    if (DEMO_MODE) return;
    setNetworkErrorFlag(false);
    this.clearRetry();

    if (!this.tracks.length) this.initPlaylist();

    if (!navigator.onLine) {
      this.scheduleColdRetry('offline');
    }

    const continueLoading = () => {
      if (isPlayAfter) {
        this.wantPlaying = true;
        this.msInitSession(trackId);
        this.selectCurrent(trackId);
        usePlayerStore.getState().setIsPlaying(true);
      }
      this.playAfterLoad = isPlayAfter;

      // Remove any pending loadedmetadata handler to prevent stacking
      if (this.pendingOnReady) {
        this.audio.removeEventListener('loadedmetadata', this.pendingOnReady);
        this.pendingOnReady = null;
      }

      const onReady = () => {
        this.audio.removeEventListener('loadedmetadata', onReady);
        this.pendingOnReady = null;
        this.goToTrack(trackId, this.playAfterLoad, true);
        this.playAfterLoad = false;
      };

      if (this.audio.readyState >= 1) {
        this.goToTrack(trackId, isPlayAfter, true);
      } else {
        this.pendingOnReady = onReady;
        this.audio.addEventListener('loadedmetadata', onReady);
      }
    };

    if (!this.isPlaylistLoaded) {
      this.ensureHlsLoaded().then(continueLoading).catch(() => {});
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
    if (DEMO_MODE) return;
    const id = trackId || this.currentTrackId;
    if (!id) return;

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

    this.audio.currentTime = audioTargetTime;
    usePlayerStore.getState().setTrackTime(id, seconds);

    if (this.isMediaSessionInit) {
      msUpdatePositionState({
        position: seconds,
        duration: d,
        playbackRate: this.audio.paused ? 0 : 1
      }, true);
    }
    usePlayerStore.setState({ inputCurrentTime: seconds });
  };

  unload = () => {
    this.wantPlaying = false;
    this.clearRetry();
    this.clearColdRetry();
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
    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[this.currentTrackId] : null;
    const audioOffset = this.offsets.get(this.currentTrackId) || 0;
    
    // (audio.currentTime - audioOffset) is the time relative to the snippet start in the manifest (0..snipDur)
    // We add snippet.start to get the absolute time in the original file (audibleStart..audibleEnd)
    return (this.audio.currentTime - audioOffset) + (snippet ? snippet.start : 0);
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
      const response = await getPlaylistPlaybackSession(this.playlistId);
      this.playlistUrl = response.playback_url;
    } catch (e) {
      console.error("[HLS] Failed to pre-flight playlist session", e);
      setNetworkErrorFlag(true, "session-failed");
      return;
    }

    if (Hls.isSupported()) {
      const urlObj = new URL(this.playlistUrl);
      const token = urlObj.searchParams.get("token");

      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
        xhrSetup: function (xhr, url) {
          if (token && url.includes(urlObj.hostname)) {
            const sep = url.includes('?') ? '&' : '?';
            xhr.open('GET', url + sep + 'token=' + token, true);
          }
        }
        // only for testing
        /*
        maxBufferLength: 1,
        maxMaxBufferLength: 1,
        maxBufferSize: 1,
        /**/
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

  private async restartHls() {
    if (!this.playlistUrl) return;

    if (this.hls) {
      try { this.hls.destroy(); } catch { /* noop */ }
      this.hls = null;
    }

    try {
      const response = await getPlaylistPlaybackSession(this.playlistId);
      this.playlistUrl = response.playback_url;
    } catch (e) {
      console.error("[HLS] Failed to refresh playlist session", e);
      return;
    }

    if (Hls.isSupported()) {
      const urlObj = new URL(this.playlistUrl);
      const token = urlObj.searchParams.get("token");

      this.hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        manifestLoadingMaxRetry: 0,
        levelLoadingMaxRetry: 0,
        fragLoadingMaxRetry: 0,
        fragLoadingTimeOut: RETRY_EVERY,
        xhrSetup: function (xhr, url) {
          if (token && url.includes(urlObj.hostname)) {
            const sep = url.includes('?') ? '&' : '?';
            xhr.open('GET', url + sep + 'token=' + token, true);
          }
        }
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
      // keep silent
    });

    this.audio.addEventListener('canplaythrough', () => {
      setNetworkErrorFlag(false);
      this.clearColdRetry();
      this.clearRetry();
    });

    this.audio.addEventListener('canplay', () => {
      setNetworkErrorFlag(false);
      this.clearColdRetry();
      this.clearRetry();
    });

    this.audio.addEventListener('playing', () => {
      setNetworkErrorFlag(false);
      this.clearColdRetry();
      this.clearRetry();
    });

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
      // console.log('--return window online');
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
          const savedTime = this.audio.currentTime;

          getPlaylistPlaybackSession(this.playlistId).then((res) => {
            this.playlistUrl = res.playback_url;
            this.restartHls().then(() => {
              this.audio.currentTime = savedTime;
              if (this.wantPlaying) {
                this.audio.play();
              }
            });
          }).catch((err) => {
            console.error("[HLS] Failed to refresh token", err);
            setNetworkErrorFlag(true, '403-refresh-failed');
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
        // console.log(`[HLS] Detected 2s gap at end of snippet, excluding from audible duration. New dur: ${snippetDuration}`);
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
    if (!allowCold && !this.wantPlaying) return;
    if (!navigator.onLine) return;

    if (!this.isPlaylistLoaded) {
      await this.ensureHlsLoaded();
    }

    if (Hls.isSupported()) {
      const t = this.audio.currentTime || 0;

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
        const isStalled = this.audio.readyState <= HTMLMediaElement.HAVE_CURRENT_DATA || bufAhead < 0.25;

        try { if (isStalled) this.hls.stopLoad(); } catch { /* noop */ }
        try {
          this.hls.startLoad(this.audio.currentTime || -1);
        } catch {
          await this.restartHls();
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
    const startOffset = this.offsets.get(this.currentTrackId) || 0;
    const meta = usePlayerStore.getState().snippetMetadata;
    const snippet = meta ? meta[this.currentTrackId] : null;
    
    // (globalT - startOffset) is position in snippet (0..snipDur)
    // Adding snippet.start gives us the absolute time in the original file
    const localT = Math.max(0, globalT - startOffset + (snippet ? snippet.start : 0));

    // console.log(`[HLS] onTimeUpdate: globalT=${globalT}, startOffset=${startOffset}, snipStart=${snippet?.start}, localT=${localT}`);

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