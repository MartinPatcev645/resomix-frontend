// mediaSession.ts
export type MediaArtwork = { src: string; sizes?: string; type?: string };
export type MediaMeta = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: MediaArtwork[];
};

const supports = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
let lastPosUpdate = 0;

type BaseHandlers = {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeekTo: (t: number) => void;
  onSeekBy: (delta: number) => void;
};

export function msInit(handlers: BaseHandlers) {
  if (!supports) return;

  navigator.mediaSession.setActionHandler('play', handlers.onPlay);
  navigator.mediaSession.setActionHandler('pause', handlers.onPause);
  navigator.mediaSession.setActionHandler('stop', handlers.onStop);

  navigator.mediaSession.setActionHandler('seekto', (e: any) => {
    if (e?.seekTime != null) handlers.onSeekTo(Number(e.seekTime) || 0);
  });

  navigator.mediaSession.setActionHandler('seekforward', (e: any) => {
    const delta = Number(e?.seekOffset ?? 10);
    handlers.onSeekBy(+delta);
  });

  navigator.mediaSession.setActionHandler('seekbackward', (e: any) => {
    const delta = Number(e?.seekOffset ?? 10);
    handlers.onSeekBy(-delta);
  });
}

export function msSetTrackControls(opts: {
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
}) {
  if (!supports) return;
  navigator.mediaSession.setActionHandler('nexttrack', opts.onNext);
  navigator.mediaSession.setActionHandler('previoustrack', opts.onPrev);
}

export function msSetMetadata(meta: MediaMeta) {
  if (!supports) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: meta.title ?? '',
      artist: meta.artist ?? '',
      album: meta.album ?? '',
      artwork: meta.artwork ?? [],
    });
  } catch {
    // no-op
  }
}

export function msSetPlaybackState(state: 'none' | 'paused' | 'playing') {
  if (!supports) return;
  navigator.mediaSession.playbackState = state;
}

export function msUpdatePositionState(input: {
  position: number;
  duration: number;
  playbackRate?: number;
}) {
  if (!supports) return;
  const now = Date.now();
  if (now - lastPosUpdate < 500) return; // троттлинг
  lastPosUpdate = now;

  const position = Math.max(0, input.position || 0);
  const duration = Math.max(0, input.duration || 0);
  const playbackRate = input.playbackRate ?? 1;

  try {
    navigator.mediaSession.setPositionState({ position, duration, playbackRate });
  } catch {
  }
}

export function msReset() {
  if (!supports) return;
  try {
    navigator.mediaSession.metadata = null;
  } catch {}
  navigator.mediaSession.playbackState = 'none';
  navigator.mediaSession.setActionHandler('nexttrack', null);
  navigator.mediaSession.setActionHandler('previoustrack', null);
}