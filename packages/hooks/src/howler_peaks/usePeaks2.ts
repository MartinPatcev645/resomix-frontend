// usePeaks.ts
import { useEffect, useRef, useState } from 'react';
import Peaks from 'peaks.js';
import WaveformData from 'waveform-data';

export type UsePeaksReturn = {
  loading: boolean;
  error: string | null;
  destroy: () => void;
};

export function usePeaks2(overviewRef: React.RefObject<HTMLElement | null>, uuid: string): UsePeaksReturn {
  const peaksRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !uuid) return;

    let cancelled = false;
    let dummyAudio: HTMLAudioElement | null = null;

    async function run() {
      setLoading(true);
      setError(null);

      // destroy previous instance if any
      if (peaksRef.current) {
        peaksRef.current.destroy();
        peaksRef.current = null;
      }

      // 1) fetch your 0..1 normalized peaks
      const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Peaks fetch failed (${res.status})`);
      const norm: number[] = await res.json();

      // 2) convert to audiowaveform v2 JSON (min/max pairs in 8-bit range)
      //    Use Int8Array for data payload (expected by waveform-data)
      const data = new Int8Array(norm.length * 2);
      for (let i = 0; i < norm.length; i++) {
        const v = Math.max(0, Math.min(1, norm[i] || 0)) * 127; // 0..127
        const p = Math.round(v) | 0;
        data[i * 2] = -p;      // min
        data[i * 2 + 1] = p;   // max
      }

      // We don’t rely on absolute duration here, so a 1-second-per-sample mapping is fine.
      const json = {
        version: 2 as const,
        channels: 1,
        sample_rate: 44100,
        samples_per_pixel: 44100, // 1 "pixel" = 1s
        bits: 8,
        length: norm.length,
        data: Array.from(data), // WaveformData.create accepts plain array
      };

      const wf = WaveformData.create(json);

      // 3) create a media element (required by Peaks even for static overview)
      dummyAudio = document.createElement('audio');
      dummyAudio.preload = 'none';
      dummyAudio.setAttribute('playsinline', '');
      dummyAudio.setAttribute('webkit-playsinline', '');

      // 4) init Peaks v3 with **overview.container** (not legacy containers{})
      await new Promise<void>((resolve, reject) => {
        const wfJson = (wf as any).toJSON ? (wf as any).toJSON() : json;
        Peaks.init(
          {
            overview: { container: el },
            mediaElement: dummyAudio!,
            waveformData: { json: wfJson },
            // keep it fixed-width (no zoomview)
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

      if (cancelled) {
        peaksRef.current?.destroy();
        peaksRef.current = null;
      }
    }

    run()
      .catch((e: any) => setError(e?.message ?? String(e)))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
      peaksRef.current?.destroy();
      peaksRef.current = null;
      // detach dummy audio
      if (dummyAudio?.parentElement) dummyAudio.parentElement.removeChild(dummyAudio);
      dummyAudio = null;
    };
  }, [overviewRef, uuid]);

  return {
    loading,
    error,
    destroy: () => {
      peaksRef.current?.destroy();
      peaksRef.current = null;
    },
  };
}
