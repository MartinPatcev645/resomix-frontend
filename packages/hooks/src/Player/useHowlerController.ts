'use client';

import { Howl } from 'howler';
import {Track, usePlayerStore, usePlaylistStore} from '@resomix/stores';
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

const isIOS =
  typeof navigator !== 'undefined' &&
  (
    /iP(hone|od|ad)/.test(navigator.platform) ||
    (navigator.userAgent.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document)
  );

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
}

let singleton: HowlerController | null = null;

export function getGlobalHowlerController(): HowlerController {
  if (singleton) return singleton;

  const howls = new Map<string, Howl>();
  const MAX_CACHE = 10;
  const pendingSeekById = new Map<string, number>();
  const seekingById = new Set<string>();
  const cleanupById = new Map<string, () => void>();

  let currentTrackId: string | null = null;
  let progressTimer: number | null = null;
  let trackPlayAfterLoad: string = '';

  let playlistIds: string[] = [];
  let tracks: Track[] = [];
  let playlistName = '';
  let lastVolume = usePlayerStore.getState().volume;

  let deferredNextToPlay: string | null = null;

  function initPlaylist() {
    const playlistData = usePlaylistStore.getState().playlistData;
    if (!playlistData) {
      return;
    }

    tracks = [];

    if (playlistData.queried_track?.id) {
      tracks.push(playlistData.queried_track);
    }

    if (playlistData.similar_tracks?.length) {
      tracks = [...tracks, ...playlistData.similar_tracks];
    }

    playlistName = playlistData.playlist?.name || '';
    playlistIds = tracks.map(el=>el.id);
  }

  function getNextTrackId(): string | null {
    if (!playlistIds.length) return null;
    const idx = playlistIds.indexOf(currentTrackId || '');
    if (idx < 0) return null;
    const nextIdx = idx + 1;
    if (nextIdx >= playlistIds.length) return null;
    return playlistIds[nextIdx];
  }

  function getPrevTrackId(): string | null {
    if (!playlistIds.length) return null;
    const idx = playlistIds.indexOf(currentTrackId || '');
    if (idx < 0) return null;
    const prevIdx = idx - 1;
    if (prevIdx < 0) return null;
    return playlistIds[prevIdx];
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

  function msSyncPosition(trackId: string, isUrgent = false) {
    if (!trackId || trackId !== currentTrackId || !howls.has(trackId)) {
      return;
    }
    const h = howls.get(trackId)!;
    const pos = getTrackTime(trackId) ?? ((h.seek() as number) || 0);

    msUpdatePositionState({
      position: pos,
      duration: h.duration() || 0,
      playbackRate: h.playing() ? 1 : 0,
    }, isUrgent);
  }

  function msSyncMetadata(trackId?: string) {
    const id = trackId || currentTrackId;
    const trackInfo: Track | undefined = tracks.find(el=>el.id === id);
    if (!trackInfo) return;
    msSetMetadata({
      title: trackInfo.title || 'Resomix Track',
      artist: trackInfo.artist || 'Music Discovery',
      album: playlistName || 'Similarity Playlist',
      artwork: [
        { src: '/logo.png', sizes: '96x96', type: 'image/png' },
        { src: '/logo.png', sizes: '128x128', type: 'image/png' },
        { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      ]
    })
    msSyncControls();
  }

  function msSyncControls() {
    const nextId = getNextTrackId();
    const prevId = getPrevTrackId();
    msSetTrackControls({
      onNext: nextId ? () => { goToTrack(nextId, true); } : null,
      onPrev: prevId ? () => { goToTrack(prevId, true); } : null,
    });
  }

  function startTicker(h: Howl) {
    if (progressTimer != null) return;
    progressTimer = window.setInterval(() => {
      const t = (h.seek() as number) || 0;
      setInputTime(t);
      const id = (h as any)._trackId as string | undefined;
      if (id && !seekingById.has(id)) {
        setTrackTime(id, t);
        msSyncPosition(id);
      }
    }, 250);
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
      oldestHowl.stop();
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
      msSetPlaybackState('playing');
      startTicker(howl);
      ensurePreloadNext();
    };
    const onpause = () => {
      log('onpause: ', trackId);
      if (!isCurrent(trackId)) return;
      msSetPlaybackState('paused');
      stopTicker();
    };
    const onstop = () => {
      log('onstop: ', trackId);
      if (!isCurrent(trackId)) return
      msSetPlaybackState('none');
      stopTicker();
    };
    const onend = () => {
      log('onend: ', trackId);
      if (!isCurrent(trackId)) return;
      stopTicker();
      setTrackTime(trackId, 0);
      const { autoplay } = usePlayerStore.getState();
      if (autoplay) {
        const nextId = getNextTrackId();
        log('next id: '+nextId);
        if (nextId) {
          const preloaded = howls.get(nextId);
          if (preloaded) {
            selectCurrent(nextId, preloaded);
            const saved = getTrackTime(nextId);
            if (saved > 0 && preloaded.state() === 'loaded') {
              preloaded.seek(saved);
              setInputTime(saved);
            }
            setIsPlaying(true);
            preloaded.play();
            ensurePreloadNext();
          } else {
            if (isIOS) {
              deferredNextToPlay = nextId;
              msSetPlaybackState('none');
            } else {
              setCurrentTrack(nextId);
              load(nextId, true);
            }
          }
        } else {
          setCurrentTrack(null);
          msSetPlaybackState('none');
          msSyncPosition(trackId, true);
        }
      } else {
        setCurrentTrack(null);
        msSetPlaybackState('none');
        msSyncPosition(trackId, true);
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

      if (trackId == currentTrackId) {
        msSyncMetadata(trackId);
        msSyncPosition(trackId, true);
      }

      if (trackPlayAfterLoad === trackId && currentTrackId === trackId) {
        play();
        trackPlayAfterLoad = '';
      }

      ensurePreloadNext();

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
        seekingById.add(trackId);
      };
      const onSeeked = () => {
        if (pendingSeekById.has(trackId)) {
          const pending = pendingSeekById.get(trackId);
          pendingSeekById.delete(trackId);
          howl.seek(pending);
        } else {
          seekingById.delete(trackId);
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
    const url = getTrackUrl(trackId);

    const howl = new Howl({
      src: [url],
      format: ['mp3'],
      html5: true,
      preload: true,
      volume: lastVolume,
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

  function pauseAllTRacks() {
    for (const [, h] of howls) {
      h.pause();
    }
  }

  function selectCurrent(trackId: string | null, howl: Howl | null = null) {
    const prev = getCurrentHowl();
    if (prev && prev !== howl) {
      stopTicker();
    }

    pauseAllTRacks();

    currentTrackId = trackId;
    setCurrentTrack(trackId);
    if (!trackId || !howl) {
      return;
    }
    usePlayerStore.setState({ isLoaded: howl.state() === 'loaded' });

    const saved = getTrackTime(trackId);
    if (howl.state() === 'loaded' && saved > 0) {
      howl.seek(saved);
      setInputTime(saved);
    }

    msSetPlaybackState('none');
    msUpdatePositionState({ position: 0, duration: 0, playbackRate: 0 }, true);

    msSyncMetadata(trackId);
  }

  function load(trackId: string, playAfter: boolean = false) {
    stop();
    if (!tracks?.length) {
      initPlaylist();
    }
    if (!trackId) {
      return;
    }

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
      ensurePreloadNext();
      return;
    }
    const howl = ensureHowl(trackId);
    selectCurrent(trackId, howl);
    howl.load();
  }

  function goToTrack(trackId: string, autoplay = false) {
    if (!tracks?.length) {
      initPlaylist();
    }
    if (!trackId) return;

    const existing = howls.get(trackId);
    if (isIOS && existing) {
      selectCurrent(trackId, existing);
      if (autoplay) {
        setIsPlaying(true);
        if (existing.state() === 'loaded') {
          const saved = getTrackTime(trackId);
          if (saved > 0) {
            existing.seek(saved);
            setInputTime(saved);
          }
          existing.play();
        } else {
          existing.once('load', () => {
            const saved = getTrackTime(trackId);
            if (saved > 0) {
              existing.seek(saved);
              setInputTime(saved);
            }
            existing.play();
          });
          existing.load();
        }
      }
      ensurePreloadNext();
      return;
    }

    load(trackId, autoplay);
  }

  function play() {
    log('play');
    setIsPlaying(true);
    msSyncPosition(currentTrackId || '', true);
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
    msSetPlaybackState('paused');
    msSyncPosition(trackId || currentTrackId || '', true);
    const h = trackId && howls.has(trackId) ? howls.get(trackId)! : getCurrentHowl();
    if (!h){
      return;
    }
    pauseAllTRacks();

    const id = (h as any)?._trackId as string | undefined;
    if (id && isCurrent(id)) {
      log('-pause', trackId);
      stopTicker();
    }
  }

  function stop() {
    log('stop');
    setIsPlaying(false);
    msSetPlaybackState('none');
    msSyncPosition(currentTrackId || '', true);
    selectCurrent(null);
    for (const [, h] of howls) {
      h.stop();
    }
    stopTicker();
  }

  function mobileSeek(t: number) {
    const h = getCurrentHowl();
    h?.seek(t)
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
    if (loaded && !seekingById.has(id)) {
      h.seek(nt);
    } else {
      pendingSeekById.set(id, nt);
    }

    setTrackTime(id, nt);
    msSyncPosition(id, true);
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

  function ensurePreloadNext() {
    const nextId = getNextTrackId();
    if (!nextId) return;
    if (!howls.has(nextId)) {
      preloadNext(nextId);
    } else {
      touch(nextId);
    }
  }

  function isLoaded() {
    const h = getCurrentHowl();
    return h?.state() === 'loaded';
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && deferredNextToPlay) {
        const nextId = deferredNextToPlay;
        deferredNextToPlay = null;
        goToTrack(nextId, true);
      }
    });
  }

  msInit({
    onPlay: () => {
      if (deferredNextToPlay) {
        const nextId = deferredNextToPlay;
        deferredNextToPlay = null;
        goToTrack(nextId, true);
      } else {
        play();
      }
    },
    onPause: () => pause(),
    onStop: () => stop(),
    onSeekTo: (t: number) => mobileSeek(t),
  });


  const updateVolume = (volume: number) => {
    if (lastVolume !== volume) {
      lastVolume = volume;
      for (const howl of howls.values()) {
        howl.volume(volume);
      }
    }
  };

  usePlayerStore.subscribe(() => {
    const volume = usePlayerStore.getState().volume;
    updateVolume(volume);
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
  };

  return singleton;
}