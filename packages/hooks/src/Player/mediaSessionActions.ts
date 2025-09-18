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
};

export function msInit(handlers: BaseHandlers) {
  if (!supports) return;

  try{
    navigator.mediaSession.setActionHandler('seekto', (e: any) => {
      if (e?.seekTime != null) {
        handlers.onSeekTo(Number(e.seekTime) || 0);
      }
    });
  }catch{}

  try {
    navigator.mediaSession.setActionHandler('play', handlers.onPlay);
  }catch{}
  try {
    navigator.mediaSession.setActionHandler('pause', handlers.onPause);
  }catch{}
  try {
    navigator.mediaSession.setActionHandler('stop', handlers.onStop);
  }catch{}

}

export function msSetTrackControls(opts: {
  onNext: (() => void) | null;
  onPrev: (() => void) | null;
}) {
  if (!supports) {
    return;
  }
  navigator.mediaSession.setActionHandler('nexttrack', opts.onNext);
  navigator.mediaSession.setActionHandler('previoustrack', opts.onPrev);

  try {
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
  } catch {}
}

export function msSetMetadata(meta: MediaMeta) {
  if (!supports) {
    return;
  }
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
}, isUrgent: boolean) {
  if (!supports) return;
  const now = Date.now();
  /*
  if (now - lastPosUpdate < 250 || !isUrgent) {
    return;
  }
   */
  lastPosUpdate = now;

  // Never send duration <= 0 to iOS - it grays out the scrubber
  const dur = Number.isFinite(input.duration) ? input.duration : 0;
  if (dur <= 0) {
    return;
  }

  let pos = Number.isFinite(input.position) ? input.position : 0;
  if (pos < 0) pos = 0;
  if (pos > dur) pos = dur;

  const playbackRate = input.playbackRate ?? 1;

  try {
    navigator.mediaSession.setPositionState({ position: Math.floor(pos), duration: Math.floor(dur), playbackRate });
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
  try {
    navigator.mediaSession.setActionHandler('seekforward', null);
    navigator.mediaSession.setActionHandler('seekbackward', null);
  } catch {}
}