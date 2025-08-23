import { useRef, useState, useEffect } from "react";
import { SERVER_MEDIA } from "@resomix/config";
import WaveformData from "waveform-data";
import { getTrackPeaks } from "@resomix/api-client";

interface PeaksApiData {
    peaks: number[];
    duration: number;
}

export interface UsePeaksOptions {
    /** Audio source URL */
    audioUrl?: string;
    /** Container that Peaks should render the overview waveform into */
    overviewRef: React.RefObject<HTMLElement | null>;
    /** Optional container for the zoom view – falls back to overview when omitted */
    zoomviewRef?: React.RefObject<HTMLElement | null>;
    /** Height of the waveform in pixels – defaults to 150 */
    height?: number;
    /** Track UUID from backend – if provided we build signed audio + peaks URLs */
    trackId?: string;
}

export interface UsePeaksReturn {
    /** Ref pointing at the <audio> element used by Peaks */
    audioRef: React.RefObject<HTMLAudioElement | null>;
    /** Whether Peaks has finished initialisation and is ready */
    isReady: boolean;
    /** Destroy the Peaks instance (mainly for cleanup) */
    destroy: () => void;
}

/**
 * Lightweight React hook that wraps Peaks.js initialisation so that any component
 * can render a waveform by simply providing an audio URL + container refs.
 *
 * Example:
 * ```tsx
 * const overviewRef = useRef(null);
 * const { audioRef } = usePeaks({ audioUrl, overviewRef });
 * ```
 */
export function usePeaks({ audioUrl, trackId, overviewRef, zoomviewRef, height = 150 }: UsePeaksOptions): UsePeaksReturn {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const peaksInstanceRef = useRef<any | null>(null);
    const waveformDataRef = useRef<any | null>(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const resolvedAudioUrl: string | undefined = audioUrl ?? (trackId ? `${SERVER_MEDIA}/signed-audio/?uuid=${trackId}` : undefined);

        if (typeof window === 'undefined' || !overviewRef.current || !resolvedAudioUrl) {
            return;
        }

        let cancelled = false;
        let localAudioEl: HTMLAudioElement;

        const ensureWaveformData = async () => {
            if (!trackId || waveformDataRef.current) return;
            try {
                const { peaks } = await getTrackPeaks(trackId) as PeaksApiData;
                const channel = new Int8Array(peaks.length);
                for (let i = 0; i < peaks.length; i++) {
                    channel[i] = Math.round(peaks[i] * 127);
                }
                waveformDataRef.current = WaveformData.create({
                    sample_rate: 1,
                    bits: 8,
                    channels: 1,
                    length: peaks.length,
                    data: [channel]
                } as any);
            } catch (e) {
                console.error('Failed to fetch track peaks', e);
            }
        };

        const init = async () => {
            try {
                const peaksModule = await import('peaks.js');
                const PeaksCtor: any = (peaksModule as any).default ?? peaksModule;

                // Reuse existing or create invisible <audio> element
                if (audioRef.current) {
                    localAudioEl = audioRef.current;
                } else {
                    localAudioEl = new Audio();
                    audioRef.current = localAudioEl;
                }

                // Configure the media element
                localAudioEl.src = resolvedAudioUrl!;
                localAudioEl.crossOrigin = 'anonymous';

                // Initialise peaks
                const initOpts: any = {
                    mediaElement: localAudioEl,
                    containers: {
                        overview: overviewRef.current!,
                        zoomview: zoomviewRef?.current ?? overviewRef.current!
                    },
                    height,
                    zoomLevels: [256, 512, 1024, 2048, 4096]
                };

                if (waveformDataRef.current) {
                    initOpts.waveformData = waveformDataRef.current;
                }

                const instance = PeaksCtor.init(initOpts);

                peaksInstanceRef.current = instance;

                instance.on('ready', () => {
                    if (!cancelled) setIsReady(true);
                });
            } catch (err) {
                console.error('[usePeaks] Failed to initialise', err);
            }
        };

        (async () => {
            await ensureWaveformData();
            if (!cancelled) {
                await init();
            }
        })();

        return () => {
            cancelled = true;
            if (peaksInstanceRef.current) {
                try {
                    peaksInstanceRef.current.destroy();
                } catch {/* ignore */}
                peaksInstanceRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioUrl, trackId, height]);

    const destroy = () => {
        if (peaksInstanceRef.current) {
            try {
                peaksInstanceRef.current.destroy();
            } catch {/* ignore */}
            peaksInstanceRef.current = null;
        }
    };

    return { audioRef, isReady, destroy };
}
