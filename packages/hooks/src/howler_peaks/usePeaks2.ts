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

      const barWidth = 3;
      const gapWidth = 2;

      const barCount = Math.floor(containerWidth / (barWidth + gapWidth));

      const data = new Int8Array(containerWidth * 2).fill(0);

      for (let i = 0; i < barCount; i++) {
        const position = (i / barCount) * (norm.length - 1);
        const index = Math.floor(position);
        const fraction = position - index;

        let value;
        if (index < norm.length - 1) {
          value = norm[index] + fraction * (norm[index + 1] - norm[index]);
        } else {
          value = norm[index];
        }

        const v = Math.max(0, Math.min(1, value || 0)) * 127;
        const p = Math.round(v) | 0;

        const barPosition = i * (barWidth + gapWidth);

        for (let j = 0; j < barWidth; j++) {
          if (barPosition + j < containerWidth) {
            data[(barPosition + j) * 2] = -p;     // min
            data[(barPosition + j) * 2 + 1] = p;  // max
          }
        }
      }

      const json = {
        version: 2 as const,
        channels: 1,
        sample_rate: 44100,
        samples_per_pixel: audioDuration * 44100 / containerWidth,
        bits: 8,
        length: containerWidth,
        data: Array.from(data),
      };

      const wf = WaveformData.create(json);
      const wfJson = (wf as any).toJSON ? (wf as any).toJSON() : json;

      const formatPlayheadTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      };

      // 3) Init Peaks v3 (overview only)
      await new Promise<void>((resolve, reject) => {
        Peaks.init(
          {
            overview: {
              container: el,
              showAxisLabels: false,
              showPlayheadTime: true,
              playheadColor: '#ff5500',
              playheadTextColor: '#fff',
              waveformColor: '#ffffff',
              playedWaveformColor: '#ff5500',
              formatPlayheadTime: formatPlayheadTime,
            },
            mediaElement: mediaElement,
            waveformData: { json: wfJson },   // …and swap later to real <audio>
            // height: el?.clientHeight || 80,
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
