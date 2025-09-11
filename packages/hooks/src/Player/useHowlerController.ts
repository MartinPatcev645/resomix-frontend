'use client';

import { Howl } from 'howler';
import { usePlayerStore } from '@resomix/stores';

export interface HowlerController {
  load: (trackId: string, isPlayAfter?: boolean) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSeconds: number) => void;
  getCurrentTime: () => number;
  readonly currentTime: number;
  getDuration: () => number;
  unload: () => void;
  getHtmlAudioNode: () => HTMLAudioElement | null;
  preloadNext: (url: string, trackId: string) => void;
  readonly isLoaded: boolean;
  getLoadingProgress: () => number;
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

  const setAudioNode = (node: HTMLAudioElement | null) =>
    usePlayerStore.getState().setAudioNode(node);
  const setCurrentTrack = (id: string | null) =>
    usePlayerStore.getState().setCurrentTrack(id);
  const setInputTime = (t: number) =>
    usePlayerStore.setState({ inputCurrentTime: t });

  const setTrackTime = (id: string, t: number) =>
    usePlayerStore.getState().setTrackTime(id, t);
  const getTrackTime = (id: string) =>
    usePlayerStore.getState().getTrackTime(id);

  function getCurrentHowl(): Howl | null {
    if (!currentTrackId) return null;
    return howls.get(currentTrackId) ?? null;
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

  function getHtmlAudioNodeFromHowl(h: Howl | null): HTMLAudioElement | null {
    const anyHowl = h as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
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
      isPlaying = true;
      startTicker(howl);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const onpause = () => {
      isPlaying = false;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    const onstop = () => {
      isPlaying = false;
      stopTicker();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
    };
    const onend = () => {
      isPlaying = false;
      stopTicker();
      setTrackTime(trackId, 0);
      const { autoplay } = usePlayerStore.getState();
      if (autoplay) {
        window.dispatchEvent(new CustomEvent('resomix:track-ended'));
      } else {
        setCurrentTrack(null);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      }
    };
    const onload = () => {
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
      howl.once('unlock', () => howl.play());
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
        url = `https://media.resomix.com/signed-audio/?uuid=${trackId}`;
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
      prev.pause();
    }

    currentTrackId = trackId;

    const node = getHtmlAudioNodeFromHowl(howl);
    setAudioNode(node);

    usePlayerStore.setState({ isLoaded: howl.state() === 'loaded' });

    const saved = getTrackTime(trackId);
    if (howl.state() === 'loaded' && saved > 0) {
      howl.seek(saved);
      setInputTime(saved);
    }
  }

  function load(trackId: string, isPlayAfter: boolean = false) {
    if (!trackId) return;

    isPlayAfterLoad = isPlayAfter;
    isPlaying = false;
    const url = `https://media.resomix.com/signed-audio/?uuid=${trackId}`;

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
    const h = getCurrentHowl();
    if (!isPlaying) {
      h?.play();
    }
  }

  function pause() {
    const h = getCurrentHowl();
    h?.pause();
  }

  function stop() {
    const h = getCurrentHowl();
    h?.stop();
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
    setAudioNode(null);
    usePlayerStore.setState({ isLoaded: false });
  }

  function getHtmlAudioNode() {
    return getHtmlAudioNodeFromHowl(getCurrentHowl());
  }

  function preloadNext(url: string, trackId: string) {
    if (howls.get(trackId)) {
      touch(trackId);
      return;
    }
    const h = createHowl(trackId, url);
    h.load();
    touch(trackId);
    evictIfNeeded();
  }

  function isLoaded() {
    const h = getCurrentHowl();
    return h?.state() === 'loaded';
  }

  function getLoadingProgress() {
    const node = getHtmlAudioNode();
    if (!node) return 0;
    const b = node.buffered;
    const d = node.duration;
    if (b.length && d > 0) return b.end(b.length - 1) / d;
    return 0;
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
    getHtmlAudioNode,
    preloadNext,
    get isLoaded() { return isLoaded(); },
    getLoadingProgress,
  };

  return singleton;
}