'use client';

import { Howl } from 'howler';
import { usePlayerStore } from '@resomix/stores';

const log = (...args: any[]) => {
  // console.log(...args);
};


export interface HowlerController {
  load: (trackId: string, isPlayAfter?: boolean) => void;
  play: () => void;
  pause: (trackId?: string) => void;
  stop: () => void;
  seek: (timeSeconds: number) => void;
  getCurrentTime: () => number;
  readonly currentTime: number;
  getDuration: () => number;
  unload: () => void;
  preloadNext: (trackId: string) => void;
  readonly isLoaded: boolean;
  initPlaylist: (ids: string[]) => void;
}

let singleton: HowlerController | null = null;

export function getGlobalHowlerController(): HowlerController {
  if (singleton) return singleton;

  const howls = new Map<string, Howl>();
  const MAX_CACHE = 10;

  let currentTrackId: string | null = null;
  let progressTimer: number | null = null;
  let isPlayAfterLoad: boolean = false;
  let isPlaying: boolean = false;

  let playlistIds: string[] = [];
  function initPlaylist(ids: string[]) {
    playlistIds = [...ids];
  }
  function getNextTrackIdx(): string {
    if (!playlistIds.length) {
      return '';
    }
    let idx = playlistIds.indexOf(currentTrackId || '');
    if (idx < 0) {
      return '';
    }
    idx ++;
    if (idx >= playlistIds.length) {
      idx = 0;
    }
    return playlistIds[idx];
  }

  const setCurrentTrack = (id: string | null) =>
    usePlayerStore.getState().setCurrentTrack(id);
  const setInputTime = (t: number) =>
    usePlayerStore.setState({ inputCurrentTime: t });

  const setTrackTime = (id: string, t: number) =>
    usePlayerStore.getState().setTrackTime(id, t);
  const getTrackTime = (id: string) =>
    usePlayerStore.getState().getTrackTime(id);

  const isCurrent = (id: string) => currentTrackId === id;

  function getCurrentHowl(): Howl | null {
    if (!currentTrackId) return null;
    return howls.get(currentTrackId) ?? null;
  }

  function getTrackUrl(trackId: string): string {
    return `https://media.resomix.com/signed-audio/?uuid=${trackId}`;
  }

  function startTicker(h: Howl) {
    if (progressTimer != null) return;
    progressTimer = window.setInterval(() => {
      const t = (h.seek() as number) || 0;
      setInputTime(t);
      const id = (h as any)._trackId as string | undefined;
      if (id) setTrackTime(id, t);
    }, 200);
  }

  function stopTicker() {
    if (progressTimer != null) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function touch(trackId: string) {
    const h = howls.get(trackId);
    if (!h) return;
    howls.delete(trackId);
    howls.set(trackId, h);
  }
  function evictIfNeeded() {
    while (howls.size > MAX_CACHE) {
      const it = howls.entries().next();
      if (it.done) break;
      const [oldestId, oldestHowl] = it.value as [string, Howl];
      if (oldestId === currentTrackId) {
        howls.delete(oldestId);
        howls.set(oldestId, oldestHowl);
        continue;
      }
      oldestHowl.unload();
      howls.delete(oldestId);
    }
  }

  function attachHowlEvents(howl: Howl, trackId: string) {
    const onplay = () => {
      if (!isCurrent(trackId)) {
        howl.pause();
        return;
      }
      log('onplay: ', trackId);
      isPlaying = true;
      startTicker(howl);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onpause = () => {
      if (!isCurrent(trackId)) return;
      log('onpause: ', trackId);
      isPlaying = false;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onstop = () => {
      if (!isCurrent(trackId)) return;
      log('onstop: ', trackId);
      isPlaying = false;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    };
    const onend = () => {
      if (!isCurrent(trackId)) return;
      log('onend: ', trackId);
      isPlaying = false;
      stopTicker();
      setTrackTime(trackId, 0);
      const { autoplay } = usePlayerStore.getState();
      if (autoplay) {
        const idx = getNextTrackIdx();
        log('next idx: '+idx);
        if (idx) {
          setCurrentTrack(idx);
          load(idx, true);
        }
      } else {
        setCurrentTrack(null);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      }
    };
    const onload = () => {
      if (!isCurrent(trackId)) return;
      usePlayerStore.setState({ isLoaded: true });
      const saved = getTrackTime(trackId);
      if (saved > 0) {
        howl.seek(saved);
        setInputTime(saved);
      }
      if (isPlayAfterLoad && currentTrackId === trackId) {
        play();
      }
    };
    const onloaderror = (_id: number, err: any) => console.error('[Howler] load error', err);
    const onplayerror = (_id: number, err: any) => {
      console.error('[Howler] play error', err);
      howl.once('unlock', () => {
        if (isCurrent(trackId)) howl.play();
      });
    };

    howl.on('play', onplay);
    howl.on('pause', onpause);
    howl.on('stop', onstop);
    howl.on('end', onend);
    howl.on('load', onload);
    howl.on('loaderror', onloaderror);
    howl.on('playerror', onplayerror);
  }

  function createHowl(trackId: string, url: string): Howl {
    const volume = usePlayerStore.getState().volume;

    const howl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume,
    });

    (howl as any)._trackId = trackId;
    attachHowlEvents(howl, trackId);

    howls.set(trackId, howl);
    touch(trackId);
    evictIfNeeded();

    return howl;
  }

  function ensureHowl(trackId: string, url?: string): Howl {
    let howl = howls.get(trackId);
    if (!howl) {
      if (!url) {
        url = getTrackUrl(trackId);
      }
      howl = createHowl(trackId, url);
    } else {
      touch(trackId);
    }
    return howl;
  }

  function selectCurrent(trackId: string, howl: Howl) {
    const prev = getCurrentHowl();
    if (prev && prev !== howl) {
      stopTicker();
    }

    for (const [id, h] of howls) {
      if (id !== trackId && h.playing()) {
        h.pause();
      }
    }

    currentTrackId = trackId;
    usePlayerStore.setState({ isLoaded: howl.state() === 'loaded' });

    const saved = getTrackTime(trackId);
    if (howl.state() === 'loaded' && saved > 0) {
      howl.seek(saved);
      setInputTime(saved);
    }
  }

  function load(trackId: string, playAfter: boolean = false) {
    if (!trackId) return;

    isPlayAfterLoad = playAfter;
    log('load', trackId);
    isPlaying = false;

    const url = getTrackUrl(trackId);
    const howl = ensureHowl(trackId, url);

    selectCurrent(trackId, howl);

    if (howl.state() !== 'loaded') {
      usePlayerStore.setState({ isLoaded: false });
      howl.load();
    } else {
      usePlayerStore.setState({ isLoaded: true });
      if (isPlayAfterLoad) {
        play();
      }
    }
  }

  function play() {
    log('play');
    const h = getCurrentHowl();
    if (!h) return;
    if (!h.playing()) {
      log('real play call');
      h.play();
    }
  }

  function pause(trackId: string = '') {
    log('pause');
    const h = trackId && howls.has(trackId) ? howls.get(trackId)! : getCurrentHowl();
    if (!h) return;
    h.pause();
    const id = (h as any)?._trackId as string | undefined;
    if (id && isCurrent(id)) {
      log('-pause', trackId);
      isPlaying = false;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
  }

  function stop() {
    log('stop');
    const h = getCurrentHowl();
    if (!h) return;
    h.stop();
    log('-stop current');
    isPlaying = false;
    stopTicker();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function seek(t: number) {
    const nt = Math.max(0, t);
    const h = getCurrentHowl();
    h?.seek(nt);
    setInputTime(nt);
    const id = (h as any)?._trackId as string | undefined;
    if (id) setTrackTime(id, nt);
  }

  function getCurrentTime() {
    const h = getCurrentHowl();
    return (h?.seek() as number) || 0;
  }

  function getDuration() {
    const h = getCurrentHowl();
    return h?.duration() ?? 0;
  }

  function unload() {
    stopTicker();
    for (const [, h] of howls) {
      h.unload();
    }
    howls.clear();
    currentTrackId = null;
    isPlaying = false;
    usePlayerStore.setState({ isLoaded: false });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function preloadNext(trackId: string) {
    if (howls.get(trackId)) {
      touch(trackId);
      return;
    }
    const url = getTrackUrl(trackId);
    const h = createHowl(trackId, url);
    h.load();
    touch(trackId);
    evictIfNeeded();
  }

  function isLoaded() {
    const h = getCurrentHowl();
    return h?.state() === 'loaded';
  }

  singleton = {
    load,
    play,
    pause,
    stop,
    seek,
    getCurrentTime,
    get currentTime() { return getCurrentTime(); },
    getDuration,
    unload,
    preloadNext,
    get isLoaded() { return isLoaded(); },
    initPlaylist,
  };

  return singleton;
}