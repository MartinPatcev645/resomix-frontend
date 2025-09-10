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

  let currentHowl: Howl | null = null;
  let nextHowl: Howl | null = null;
  let progressTimer: number | null = null;
  let isLoadedStatus: boolean = false;
  let isPlayAfterLoad: boolean = false;

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

  function load(trackId: string, isPlayAfter:boolean = false) {

    if (!trackId) {
      return;
    }
    isPlayAfterLoad = isPlayAfter;

    const url :string = `https://media.resomix.com/signed-audio/?uuid=${trackId}`

    isLoadedStatus = false;

    if (currentHowl) {
      stopTicker();
      currentHowl.pause();
      currentHowl.unload();
      currentHowl = null;
      setAudioNode(null);
    }

    if (nextHowl && trackId === (nextHowl as any)._trackId) {
      currentHowl = nextHowl;
      nextHowl = null;

      const node = (currentHowl as any)?._sounds?.[0]?._node ?? null;
      if (node) {
        setAudioNode(node);
      }

      const saved = getTrackTime(trackId);
      if (saved > 0) {
        currentHowl.seek(saved);
        setInputTime(saved);
      }
      return;
    }

    const volume = usePlayerStore.getState().volume;

    const howl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume,
      onplay: () => {
        // setCurrentTrack(trackId);
        startTicker(howl);
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      },
      onpause: () => {
        stopTicker();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      },
      onstop: () => {
        stopTicker();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
      },
      onend: () => {
        stopTicker();
        setTrackTime(trackId, 0);
        const { autoplay } = usePlayerStore.getState();
        if (autoplay) {
          window.dispatchEvent(new CustomEvent('resomix:track-ended'));
        } else {
          setCurrentTrack(null);
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
        }
      },
      onload: () => {
        isLoadedStatus = true;
        usePlayerStore.setState({ isLoaded: true });

        const saved = getTrackTime(trackId);
        if (saved > 0) {
          howl.seek(saved);
          setInputTime(saved);
        }

        if (isPlayAfterLoad) {
          play();
        }
      },
      onloaderror: (_id, err) => console.error('[Howler] load error', err),
      onplayerror: (_id, err) => {
        console.error('[Howler] play error', err);
        howl.once('unlock', () => howl.play());
      },
    });

    (howl as any)._trackId = trackId;

    currentHowl = howl;

    const node = (howl as any)?._sounds?.[0]?._node ?? null;
    if (node) {
      setAudioNode(node);
    }
  }

  function play() {
    currentHowl?.play();
  }
  function pause() {
    currentHowl?.pause(); }
  function stop() {
    currentHowl?.stop();
  }

  function seek(t: number) {
    const nt = Math.max(0, t);
    currentHowl?.seek(nt);
    setInputTime(nt);
    const id = (currentHowl as any)?._trackId as string | undefined;
    if (id) setTrackTime(id, nt);
  }

  function getCurrentTime() {
    return (currentHowl?.seek() as number) || 0;
  }
  function getDuration() {
    return currentHowl?.duration() ?? 0;
  }
  function unload() {
    stopTicker();
    if (currentHowl) {
      currentHowl.unload();
      currentHowl = null;
    }
    if (nextHowl) { nextHowl.unload(); nextHowl = null; }
    setAudioNode(null);
  }
  function getHtmlAudioNode() {
    const anyHowl = currentHowl as any;
    return anyHowl?._sounds?.[0]?._node ?? null;
  }
  function preloadNext(url: string, trackId: string) {
    if (nextHowl) { nextHowl.unload(); nextHowl = null; }
    const volume = usePlayerStore.getState().volume;
    const h = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume,
    });
    (h as any)._trackId = trackId;
    nextHowl = h;
  }
  function isLoaded() {
    return isLoadedStatus;
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

// Volume change
/*
usePlayerStore.subscribe(
  (s) => s.volume,
  (v) => {
    currentHowl?.volume(v);
    nextHowl?.volume(v);
  }
);
 */