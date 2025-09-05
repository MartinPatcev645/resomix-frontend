// usePeaks2.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import Peaks, { type PeaksInstance } from 'peaks.js';
import WaveformData from 'waveform-data';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  destroy: () => void;
  /** Bind the real <audio> (e.g., from Howler) so the playhead follows playback */
  attachMediaElement: (el: HTMLAudioElement | null) => void;
};

/**
 * Minimal Peaks v3 hook.
 * - Renders an overview-only waveform from your 0..1 JSON
 * - Starts with a dummy <audio> so UI appears instantly
 * - Later you can attach the real <audio> so playhead & seeking sync
 */
export function usePeaks2(
  overviewRef: React.RefObject<HTMLElement | null>,
  uuid: string
): UsePeaksReturn {
  const peaksRef = useRef<PeaksInstance | null>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [mediaElement, setMediaElement ] = useState<HTMLMediaElement | null>(null);

  const destroy = useCallback(() => {
    try { peaksRef.current?.destroy(); } catch {}
    peaksRef.current = null;
  }, []);

  const attachMediaElement = useCallback((el: HTMLAudioElement | null) => {
    setMediaElement(el);
  }, []);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !uuid || !mediaElement) return;

    let cancelled = false;

    async function init() {
      if (!mediaElement || !el) return;

      setLoading(true);
      setError(null);

      // Clean any previous instance
      destroy();

      // 1) Fetch your 0..1 normalized peaks
      const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Peaks fetch failed (${res.status})`);
      const norm: number[] = await res.json();


      const audioDuration = norm.length;
      const containerWidth = el.clientWidth;
      const totalSamples = audioDuration * 44100;
      const samplesPerPixel = totalSamples / containerWidth;

      const interpolatedNorm = new Array(containerWidth);
      for (let i = 0; i < containerWidth; i++) {
        const position = (i / containerWidth) * (norm.length - 1);
        const index = Math.floor(position);
        const fraction = position - index;

        if (index < norm.length - 1) {
          interpolatedNorm[i] = norm[index] + fraction * (norm[index + 1] - norm[index]);
        } else {
          interpolatedNorm[i] = norm[index];
        }
      }

      // 2) Convert interpolation to audiowaveform v2 JSON (min/max 8-bit symmetric)
      const data = new Int8Array(interpolatedNorm.length * 2);
      for (let i = 0; i < interpolatedNorm.length; i++) {
        const v = Math.max(0, Math.min(1, interpolatedNorm[i] || 0)) * 127; // 0 .. 127
        const p = Math.round(v) | 0;
        data[i * 2] = -p; // min
        data[i * 2 + 1] = p; // max
      }

      const json = {
        version: 2 as const,
        channels: 1,
        sample_rate: 44100,
        samples_per_pixel: samplesPerPixel,
        bits: 8,
        length: interpolatedNorm.length,
        data: Array.from(data),
      };

      const wf = WaveformData.create(json);
      const wfJson = (wf as any).toJSON ? (wf as any).toJSON() : json;

      // 3) Init Peaks v3 (overview only)
      await new Promise<void>((resolve, reject) => {
        Peaks.init(
          {
            overview: { container: el },
            mediaElement: mediaElement,              // bind dummy now…
            waveformData: { json: wfJson },   // …and swap later to real <audio>
            // height: el?.clientHeight || 80,

            // Colors
            waveformColor: '#ffffff',
            playheadColor: '#ff6b6b',
            playheadTextColor: '#ffffff',
          },
          (err, instance) => {
            if (err) return reject(err);
            peaksRef.current = instance!;
            resolve();
          }
        );
      });

      if (cancelled) destroy();
    }

    init()
      .catch((e: any) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      destroy();
    };
  }, [overviewRef, uuid, destroy, mediaElement]);

  return { loading, error, destroy, attachMediaElement };
}
