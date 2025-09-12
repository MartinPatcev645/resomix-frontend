'use client';

import { Howl } from 'howler';
import {Track, usePlayerStore} from '@resomix/stores';
import {
  msInit,
  msSetTrackControls,
  msSetMetadata,
  msSetPlaybackState,
  msUpdatePositionState,
  msReset,
} from './mediaSessionActions'

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
  initPlaylist: (list: Track[]) => void;
}

let singleton: HowlerController | null = null;

export function getGlobalHowlerController(): HowlerController {
  if (singleton) return singleton;

  const howls = new Map<string, Howl>();
  const MAX_CACHE = 10;
  const pendingSeekById = new Map<string, number | null>();
  const seekingById = new Map<string, boolean>();
  const cleanupById = new Map<string, () => void>();

  let currentTrackId: string | null = null;
  let progressTimer: number | null = null;
  let trackPlayAfterLoad: string = '';

  let playlistIds: string[] = [];
  let tracks: Track[] = [];
  function initPlaylist(tracksList: Track[]) {
    tracks = [...tracksList];
    playlistIds = tracksList.map(el=>el.id);
    if (currentTrackId) {
      const nextId = getNextTrackIdx();
      const prevId = getPrevTrackIdx();
      msSetTrackControls({
        onNext: nextId ? () => { load(nextId, true); } : null,
        onPrev: prevId ? () => { load(prevId, true); } : null,
      });
    }
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

  function getPrevTrackIdx(): string {
    if (!playlistIds.length) {
      return '';
    }
    let idx = playlistIds.indexOf(currentTrackId || '');
    if (idx < 0) {
      return '';
    }
    idx--;
    if (idx < 0) {
      idx = playlistIds.length - 1;
    }
    return playlistIds[idx];
  }

  const setCurrentTrack = (id: string | null) =>
    usePlayerStore.getState().setCurrentTrack(id);
  const setInputTime = (t: number) =>
    usePlayerStore.setState({ inputCurrentTime: t });
  const setIsPlaying = (val: boolean) =>
    usePlayerStore.getState().setIsPlaying(val);

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

  function msSyncPosition(trackId: string) {
    if (!trackId || trackId !== currentTrackId || !howls.has(trackId)) {
      return;
    }
    const h = getCurrentHowl();
    const pos = getTrackTime(trackId) || 0;
    msUpdatePositionState({
      position: pos,
      duration: h?.duration() || 0,
      playbackRate: h?.playing() ? 1 : 1
    });
  }

  function msSyncMetadata(trackId?: string) {
    const id = trackId || currentTrackId;
    const trackInfo: Track | undefined = tracks.find(el=>el.id === id);
    if (!trackInfo) return;
    msSetMetadata({
      title: trackInfo.title || 'Resomix Track',
      artist: trackInfo.artist || 'Music Discovery',
      album: 'Similarity Playlist',
      artwork: [
        { src: '/logo.png', sizes: '96x96', type: 'image/png' },
        { src: '/logo.png', sizes: '128x128', type: 'image/png' },
        { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      ]
    })
  }

  function startTicker(h: Howl) {
    if (progressTimer != null) return;
    progressTimer = window.setInterval(() => {
      const t = (h.seek() as number) || 0;
      setInputTime(t);
      const id = (h as any)._trackId as string | undefined;
      if (id){
        setTrackTime(id, t);
        msSyncPosition(id);
      }
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
      cleanupById.get(oldestId)?.();
      oldestHowl.unload();
      howls.delete(oldestId);
    }
  }

  function attachHowlEvents(howl: Howl, trackId: string) {
    const onplay = () => {
      log('onplay: ', trackId);
      if (!isCurrent(trackId)) {
        howl.pause();
        return;
      }
      startTicker(howl);
      msSetPlaybackState('playing');
      msSyncPosition(trackId);
    };
    const onpause = () => {
      log('onpause: ', trackId);
      if (!isCurrent(trackId)) return;
      stopTicker();
      msSetPlaybackState('paused');
      msSyncPosition(trackId);
    };
    const onstop = () => {
      log('onstop: ', trackId);
      if (!isCurrent(trackId)) return;
      log('onstop: ', trackId);
      stopTicker();
      msSetPlaybackState('none');
      msSyncPosition(trackId);
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
        msSetPlaybackState('none');
        msSyncPosition(trackId);
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

      msSyncMetadata(trackId)
      msSyncPosition(trackId);

      if (trackPlayAfterLoad === trackId && currentTrackId === trackId) {
        play();
        trackPlayAfterLoad = '';
      }
      wireNode();
    };
    const onloaderror = (_id: number, err: any) => console.error('[Howler] load error', err);
    const onplayerror = (_id: number, err: any) => {
      console.error('[Howler] play error', err);
      howl.once('unlock', () => {
        if (isCurrent(trackId)) {
          setIsPlaying(true);
          howl.play();
        }
      });
    };

    const wireNode = () => {
      const node = (howl as any)?._sounds?.[0]?._node as HTMLAudioElement | undefined;
      if (!node || cleanupById.has(trackId)) return;

      const onSeeking = () => {
        seekingById.set(trackId, true);
      };
      const onSeeked = () => {
        const pending = pendingSeekById.get(trackId);
        if (pending != null) {
          pendingSeekById.set(trackId, null);
          howl.seek(pending);
        } else {
          seekingById.set(trackId, false);
        }
      };

      node.addEventListener('seeking', onSeeking);
      node.addEventListener('seeked', onSeeked);

      cleanupById.set(trackId, () => {
        node.removeEventListener('seeking', onSeeking);
        node.removeEventListener('seeked', onSeeked);
        cleanupById.delete(trackId);
        seekingById.delete(trackId);
        pendingSeekById.delete(trackId);
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
    setCurrentTrack(trackId)
    usePlayerStore.setState({ isLoaded: howl.state() === 'loaded' });

    const saved = getTrackTime(trackId);
    if (howl.state() === 'loaded' && saved > 0) {
      howl.seek(saved);
      setInputTime(saved);
    }

    const nextId = getNextTrackIdx();
    const prevId = getPrevTrackIdx();
    msSetTrackControls({
      onNext: nextId ? () => { load(nextId, true); } : null,
      onPrev: prevId ? () => { load(prevId, true); } : null,
    });

    msSyncMetadata(trackId);
    msSetPlaybackState(howl.playing() ? 'playing' : (usePlayerStore.getState().isLoaded ? 'paused' : 'none'));
    msSyncPosition(trackId);
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
    setIsPlaying(true);
    const h = getCurrentHowl();
    if (!h) return;
    if (!h.playing()) {
      log('real play call');
      h.play();
    }
  }

  function pause(trackId: string = '') {
    log('pause');
    setIsPlaying(false);
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
    setIsPlaying(false);
    const h = getCurrentHowl();
    if (!h) return;
    h.stop();
    log('-stop current');
    stopTicker();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
  }

  function seek(t: number, trackId: string = '') {
    const nt = Math.max(0, t);

    let id = trackId;
    let h: Howl | null = trackId ? (howls.get(trackId) ?? null) : getCurrentHowl();
    if (!id && h){
      id = currentTrackId || '';
    }
    if (!h || !id) {
      return;
    }
    const loaded = h.state() === 'loaded';
    const busy = seekingById.get(id) === true;

    if (loaded && !busy) {
      h.seek(nt);
    } else {
      pendingSeekById.set(id, nt);
    }

    setTrackTime(id, nt);
    msSyncPosition(trackId);
    if (!trackId) {
      setInputTime(nt);
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
    log('unload');
    stopTicker();
    for (const [id, h] of howls) {
      cleanupById.get(id)?.();
      h.unload();
    }
    howls.clear();
    currentTrackId = null;
    usePlayerStore.setState({ isLoaded: false });
    msReset();
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

  msInit({
    onPlay: () => play(),
    onPause: () => pause(),
    onStop: () => stop(),
    onSeekTo: (t: number) => seek(t),
    onSeekBy: (delta: number) => seek(getCurrentTime() + delta),
  });

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