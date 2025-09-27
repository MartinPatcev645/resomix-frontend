import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCustomPeaks } from "../Waveform/useCustomPeaks";
import { useDebouncedWaveformSeek } from "../Waveform/useDebouncedWaveformSeek";
import { useGlobalAudioController } from "./AudioProvider";
import { usePlayerStore } from "@resomix/stores";

// Constants shared by both player components
const SEEK_DEBOUNCE_MS = 300;
const HOLD_AFTER_SEEK_MS = 200;

// Simple mm:ss formatter (shared utility)
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface WaveformControlOptions {
  id?: string; // can be undefined for uploaded-local
  totalDuration: number;
  withPlayPause?: boolean; // include isPlaying / togglePlay helpers
}

export function useWaveformControls({ id, totalDuration, withPlayPause = false }: WaveformControlOptions) {
  // 1. Resolve the effective track ID (InputPlayer may not yet have a server uuid)
  const effectiveId = id ?? "uploaded-local";

  // 2. Peaks waveform hook
  const { loading: wfLoading, error: wfError, setTime, attachOverviewElement } = useCustomPeaks(id || "");

  // 3. Global audio controller
  const hlsController = useGlobalAudioController();

  // 4. Global store selectors
  const currentTime = usePlayerStore((s) => s.trackTimes?.[effectiveId] ?? 0);
  const setTrackTime = usePlayerStore((s) => s.setTrackTime);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isCommonPlay = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);

  // 5. Waveform seek helpers
  const { containerRef, isDragging, uiTime, requestSeek } = useDebouncedWaveformSeek({
    id: effectiveId,
    totalDuration,
    currentTime,
    setTime,
    onPreview: (t: number) => setTrackTime(effectiveId, t),
    onCommit: (t: number) => {
      if (currentTrackId === effectiveId) {
        hlsController.seek(t, effectiveId);
      }
      setTrackTime(effectiveId, t);
    },
    debounceMs: SEEK_DEBOUNCE_MS,
    holdAfterMs: HOLD_AFTER_SEEK_MS,
  });

  // 6. Playback helpers (optional)
  const isPlaying = isCommonPlay && currentTrackId === effectiveId;

  const togglePlay = useCallback(() => {
    if (!withPlayPause) return; // safeguard
    if (!hlsController) return;

    if (isPlaying) {
      hlsController.pause();
    } else {
      if (currentTrackId !== effectiveId) {
        hlsController.load(effectiveId, true);
      } else {
        hlsController.play();
      }
    }
  }, [withPlayPause, hlsController, isPlaying, currentTrackId, effectiveId]);

  // 7. Skip helpers (±10s)
  const skipBackward = useCallback(() => {
    if (!hlsController) return;
    const base = uiTime || 0;
    requestSeek(Math.max(0, base - 10));
  }, [hlsController, uiTime, requestSeek]);

  const skipForward = useCallback(() => {
    if (!hlsController) return;
    const d = Number.isFinite(hlsController.getDuration()) ? hlsController.getDuration() : totalDuration;
    const base = uiTime || 0;
    requestSeek(Math.min(d, base + 10));
  }, [hlsController, uiTime, totalDuration, requestSeek]);

  // 8. Volume helpers
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
  }, [setVolume]);

  const toggleMute = useCallback(() => {
    setVolume(volume === 0 ? 0.7 : 0);
  }, [setVolume, volume]);

  // 9. Auto-load track to controller for InputPlayer-type components
  useEffect(() => {
    if (withPlayPause) {
      hlsController.load(effectiveId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveId]);

  return {
    // waveform
    containerRef,
    attachOverviewElement,
    wfLoading,
    wfError,
    isDragging,
    uiTime,
    // playback
    isPlaying,
    togglePlay: withPlayPause ? togglePlay : undefined,
    skipBackward,
    skipForward,
    // volume
    volume,
    handleVolumeChange,
    toggleMute,
  } as const;
}
