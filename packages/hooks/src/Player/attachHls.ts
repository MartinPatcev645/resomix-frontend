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
 */
export function attachHls(audio: HTMLAudioElement, url: string): () => void {
  if (Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
    hls.loadSource(url);
    hls.attachMedia(audio);
    return () => {
      try { hls.destroy(); } catch { /* noop */ }
    };
  }
  // Safari / native HLS — the browser plays the .m3u8 directly.
  audio.src = url;
  audio.load();
  return () => {
    try { audio.removeAttribute('src'); audio.load(); } catch { /* noop */ }
  };
}
