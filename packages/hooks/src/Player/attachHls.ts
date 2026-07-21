import Hls from 'hls.js';

/**
 * Attach a single HLS stream to a plain <audio> element and return a teardown fn.
 *
 * Used by the analysis screen to play the uploaded track from the media server: it reuses the
 * upload's sibling similarity playlist's seed-only .m3u8 (the same segments the playlist page
 * streams), so no peaks / queue / controller machinery is needed. The manifest's segment URLs
 * already carry their edge-auth `?token=` (Alwyzon injects it), so hls.js just loads the URL.
 *
 * Uses hls.js where supported; falls back to native HLS (Safari) via a plain `src`. The returned
 * cleanup destroys the hls.js instance (or clears the element source) — call it on unmount or
 * before attaching a different stream.
 *
 * Resilience: hls.js is given explicit fatal-error recovery — a transient network error retries
 * the load, a media error is recovered in place — each bounded so a genuinely gone/expired stream
 * can't loop forever. When recovery is exhausted (or the manifest is unrecoverable), `onFatal` is
 * invoked so the caller can surface "audio unavailable" instead of a silently dead player.
 */
export function attachHls(
  audio: HTMLAudioElement,
  url: string,
  onFatal?: () => void,
): () => void {
  if (Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });

    let networkRetries = 0;
    let mediaRecoveries = 0;
    const MAX_NETWORK_RETRIES = 3; // beyond hls.js's own per-load retries
    const MAX_MEDIA_RECOVERIES = 2;

    hls.on(Hls.Events.ERROR, (_evt, data) => {
      if (!data.fatal) return; // non-fatal — hls.js handles it internally
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // Manifest/fragment couldn't load — often the m3u8 lagging just-created segments, or a
        // brief blip. Retry a few times, then give up gracefully.
        if (networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries += 1;
          try { hls.startLoad(); return; } catch { /* fall through to fatal */ }
        }
        try { hls.destroy(); } catch { /* noop */ }
        onFatal?.();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        if (mediaRecoveries < MAX_MEDIA_RECOVERIES) {
          mediaRecoveries += 1;
          try { hls.recoverMediaError(); return; } catch { /* fall through to fatal */ }
        }
        try { hls.destroy(); } catch { /* noop */ }
        onFatal?.();
      } else {
        // OTHER_ERROR (e.g. mux) — not recoverable here.
        try { hls.destroy(); } catch { /* noop */ }
        onFatal?.();
      }
    });

    hls.loadSource(url);
    hls.attachMedia(audio);
    return () => {
      try { hls.destroy(); } catch { /* noop */ }
    };
  }

  // Safari / native HLS — the browser plays the .m3u8 directly.
  audio.src = url;
  audio.load();
  const onErr = () => onFatal?.();
  audio.addEventListener('error', onErr);
  return () => {
    audio.removeEventListener('error', onErr);
    try { audio.removeAttribute('src'); audio.load(); } catch { /* noop */ }
  };
}
