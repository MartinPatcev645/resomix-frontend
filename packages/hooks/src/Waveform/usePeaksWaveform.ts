import { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';
import WaveformData from 'waveform-data';
import { usePlayerStore } from '@resomix/stores';

export interface UsePeaksWaveformProps {
  containerRef: React.RefObject<HTMLElement | null>;
  trackId?: string;
  height?: number;             // used via CSS on the container; Peaks uses container’s height
  onReady?: (peaks: any) => void;
}

export function usePeaksWaveform({
  containerRef,
  trackId,
  height = 80,       // keep for API parity; actual height should come from container CSS
  onReady,
}: UsePeaksWaveformProps) {
  const peaksRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio node from store (may be null). We DO NOT depend on it to init Peaks,
  // we just bind it later to get a live playhead when available.
  const audioElement = usePlayerStore((s) => s.audioNode);

  // Keep one dummy audio element for static mode
  const dummyAudioRef = useRef<HTMLAudioElement | null>(null);
  if (!dummyAudioRef.current) {
    const el = document.createElement('audio');
    el.preload = 'none';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    dummyAudioRef.current = el;
  }

  // Abortable fetch controller
  const fetchAbortRef = useRef<AbortController | null>(null);

  // ---- INIT once per (container, trackId) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !trackId) return;

    let destroyed = false;

    async function init() {
      setIsLoading(true);
      setError(null);

      // clean previous
      if (peaksRef.current) {
        try { peaksRef.current.destroy(); } catch { }
        peaksRef.current = null;
      }
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
      fetchAbortRef.current = new AbortController();

      try {
        // 1) fetch your normalized [0..1] array
        const resp = await fetch(`https://media.resomix.com/peaks/?uuid=${trackId}`, {
          signal: fetchAbortRef.current.signal,
          cache: 'no-store',
        });
        const norm: number[] = await resp.json();

        // 2) convert to 8-bit interleaved min/max pairs with 1 value per second
        const wf = toWaveformDataFromNormalized(norm);

        // 3) choose a media element (dummy for static view)
        const mediaEl = audioElement ?? dummyAudioRef.current!;

        // 4) v3 API: overview container only, no zoomview
        const options: any = {
          mediaElement: mediaEl,
          waveformData: wf,
          overview: {
            container,                       // REQUIRED in v3
            waveformColor: '#ffffff',
            highlightColor: '#ff6b6b',
          },
          // do not set zoomview to keep it non-zoomable
          // style/height comes from container CSS; keep the Tailwind height you already have
        };

        Peaks.init(options, (err, instance) => {
          if (destroyed) return;
          if (err) {
            console.error('[usePeaksWaveform] Peaks init failed:', err);
            setError(err.message || 'Peaks init error');
            setIsLoading(false);
            return;
          }
          peaksRef.current = instance;
          setIsLoading(false);
          onReady?.(instance);
        });
      } catch (e: any) {
        if (destroyed) return;
        if (e?.name === 'AbortError') return; // re-init race, ignore
        console.error('[usePeaksWaveform] Failed to load waveform data:', e);
        setError('Failed to load waveform data');
        setIsLoading(false);
      }
    }

    init();

    return () => {
      destroyed = true;
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
        fetchAbortRef.current = null;
      }
      if (peaksRef.current) {
        try { peaksRef.current.destroy(); } catch { }
        peaksRef.current = null;
      }
    };
    // IMPORTANT: do NOT depend on audioElement here
  }, [containerRef, trackId, onReady]);

  // ---- Bind the real audio element later (for live playhead/seek) ----
  useEffect(() => {
    const p = peaksRef.current;
    if (!p || !audioElement) return;
    try {
      // v3 exposes a player with setMediaElement
      // (older minors had same method name)
      if (p.player && typeof p.player.setMediaElement === 'function') {
        p.player.setMediaElement(audioElement);
      }
    } catch (e) {
      console.warn('[usePeaksWaveform] setMediaElement failed:', e);
    }
  }, [audioElement]);

  // click-to-seek (only when a real audio node exists)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (ev: MouseEvent) => {
      if (!audioElement || !isFinite(audioElement.duration) || audioElement.duration <= 0) return;
      const r = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
      audioElement.currentTime = x * audioElement.duration;
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [containerRef, audioElement]);

  return { peaksInstance: peaksRef.current, isLoading, error };
}

// Build a compact WaveformData (8-bit, 1 value per second)
function toWaveformDataFromNormalized(values: number[]) {
  // Interleaved min/max for each “pixel”
  const data = new Int8Array(values.length * 2);
  for (let i = 0; i < values.length; i++) {
    const amp = Math.max(0, Math.min(1, values[i] || 0));
    const v = Math.round(amp * 127); // 8-bit
    data[i * 2] = -v;    // min
    data[i * 2 + 1] = v; // max
  }
  // Peaks expects the WaveformData v2 JSON shape (8-bit interleaved min/max pairs).
  // Keep sample_rate=samples_per_pixel=1 so duration = length seconds.
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: 1,
    samples_per_pixel: 1,
    bits: 8,
    length: values.length,
    data: Array.from(data),
  });
}
