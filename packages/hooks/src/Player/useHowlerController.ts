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
  seek: (timeSeconds: number, trackId: string) => void;
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
  let trackPlayAfterLoad: string = '';

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
    log('onplay: ', trackId);
    const onplay = () => {
      if (!isCurrent(trackId)) {
        howl.pause();
        return;
      }
      startTicker(howl);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onpause = () => {
      log('onpause: ', trackId);
      if (!isCurrent(trackId)) return;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onstop = () => {
      log('onstop: ', trackId);
      if (!isCurrent(trackId)) return;
      log('onstop: ', trackId);
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    };
    const onend = () => {
      log('onend: ', trackId);
      if (!isCurrent(trackId)) return;
      log('onend: ', trackId);
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
      log('onload: ', trackId);
      if (!isCurrent(trackId)) return;
      usePlayerStore.setState({ isLoaded: true });
      const saved = getTrackTime(trackId);
      if (saved > 0) {
        howl.seek(saved);
        setInputTime(saved);
      }
      if (trackPlayAfterLoad === trackId && currentTrackId === trackId) {
        play();
        trackPlayAfterLoad = '';
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

  function createHowl(trackId: string): Howl {
    const volume = usePlayerStore.getState().volume;
    const url = getTrackUrl(trackId);

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

  function ensureHowl(trackId: string): Howl {
    let howl = howls.get(trackId);
    if (!howl) {
      howl = createHowl(trackId);
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

    trackPlayAfterLoad = playAfter ? trackId : '';
    log('load', trackId);
    if (howls.has(trackId)) {
      log('load queue has track', trackId);
      const howl = ensureHowl(trackId);
      selectCurrent(trackId, howl);
      if (trackPlayAfterLoad && howl?.state() === 'loaded') {
        play();
        trackPlayAfterLoad = '';
      }
      return;
    }
    const howl = ensureHowl(trackId);
    selectCurrent(trackId, howl);
    howl.load();
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
    stopTicker();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function seek(t: number, trackId: string = '') {
    const nt = Math.max(0, t);
    let h = getCurrentHowl();
    if (trackId) {
      if (!howls.has(trackId)) {
        return;
      }
      h = howls.get(trackId) || null;
      h?.seek(nt);
      setTrackTime(trackId, nt);
    }
    else {
      h?.seek(nt);
      setInputTime(nt);
      setTrackTime(trackId, nt);
    }
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
    usePlayerStore.setState({ isLoaded: false });
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function preloadNext(trackId: string) {
    if (howls.get(trackId)) {
      touch(trackId);
      return;
    }
    const h = createHowl(trackId);
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