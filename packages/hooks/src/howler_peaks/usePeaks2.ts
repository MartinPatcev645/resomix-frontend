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
  const dummyAudioRef = useRef<HTMLAudioElement | null>(null);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const destroy = useCallback(() => {
    try { peaksRef.current?.destroy(); } catch {}
    peaksRef.current = null;
    // drop dummy
    if (dummyAudioRef.current?.parentElement) {
      dummyAudioRef.current.parentElement.removeChild(dummyAudioRef.current);
    }
    dummyAudioRef.current = null;
  }, []);

  const attachMediaElement = useCallback((el: HTMLAudioElement | null) => {
    if (!peaksRef.current || !el) return;
    // v3: use the player API to swap the media element
    // @ts-expect-error: player typings vary across builds
    if (peaksRef.current.player?.setMediaElement) {
      // @ts-ignore
      peaksRef.current.player.setMediaElement(el);
    }
  }, []);

  useEffect(() => {
    const el = overviewRef.current;
    if (!el || !uuid) return;

    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      // Clean any previous instance
      destroy();

      // 1) Fetch your 0..1 normalized peaks
      const res = await fetch(`https://media.resomix.com/peaks/?uuid=${uuid}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Peaks fetch failed (${res.status})`);
      const norm: number[] = await res.json();

      // 2) Convert to audiowaveform v2 JSON (min/max 8-bit symmetric)
      const data = new Int8Array(norm.length * 2);
      for (let i = 0; i < norm.length; i++) {
        const v = Math.max(0, Math.min(1, norm[i] || 0)) * 127; // 0..127
        const p = Math.round(v) | 0;
        data[i * 2]     = -p;  // min
        data[i * 2 + 1] =  p;  // max
      }

      const json = {
        version: 2 as const,
        channels: 1,
        sample_rate: 44100,
        samples_per_pixel: 44100, // 1 "pixel" = 1s (good enough for fixed bars)
        bits: 8,
        length: norm.length,
        data: Array.from(data),
      };

      const wf = WaveformData.create(json);
      const wfJson = (wf as any).toJSON ? (wf as any).toJSON() : json;

      // 3) Create a dummy <audio> so Peaks can initialize immediately
      const dummy = document.createElement('audio');
      dummy.preload = 'none';
      dummy.setAttribute('playsinline', '');
      dummy.setAttribute('webkit-playsinline', '');
      dummyAudioRef.current = dummy;

      // 4) Init Peaks v3 (overview only)
      await new Promise<void>((resolve, reject) => {
        Peaks.init(
          {
            overview: { container: el },
            mediaElement: dummy,              // bind dummy now…
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
  }, [overviewRef, uuid, destroy]);

  return { loading, error, destroy, attachMediaElement };
}
