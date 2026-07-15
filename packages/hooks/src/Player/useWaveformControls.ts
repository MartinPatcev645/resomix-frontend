import { useCallback, useEffect, useMemo, useRef } from "react";
import { useCustomPeaks } from "../Waveform/useCustomPeaks";
import { useDebouncedWaveformSeek } from "../Waveform/useDebouncedWaveformSeek";
import { useGlobalAudioController } from "./AudioProvider";
import { usePlayerStore, usePlaylistStore } from "@resomix/stores";

// Constants shared by both player components
const SEEK_DEBOUNCE_MS = 300;
const HOLD_AFTER_SEEK_MS = 500;

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

  // 1a. Resolve the track + its playback engine up-front. Catalogue tracks (playback === 'preview')
  //     stream from the Apple Music preview URL and have NO server peaks — so we skip the peaks fetch
  //     and the components render a simple progress line instead of a waveform.
  const playlistData = usePlaylistStore((s: any) => s.playlistData);
  const track = useMemo(() => {
    if (playlistData?.queried_track?.id === effectiveId) return playlistData.queried_track;
    return playlistData?.similar_tracks?.find((t: any) => t.id === effectiveId);
  }, [playlistData, effectiveId]);
  const isPreview = track?.playback === 'preview';
  const isUpload = track?.type === 'upload';

  // 2. Peaks waveform hook — empty uuid (skips the fetch) for preview tracks.
  const { loading: wfLoading, error: wfError, setTime, attachOverviewElement, setRestrictedRange } = useCustomPeaks(isPreview ? "" : (id || ""), usePlayerStore(s => !!s.deletedTracks[effectiveId]));

  // 3. Global audio controller
  const hlsController = useGlobalAudioController();

  // 4. Global store selectors
  const currentTime = usePlayerStore((s) => s.trackTimes?.[effectiveId] ?? 0);
  const setTrackTime = usePlayerStore((s) => s.setTrackTime);
  const currentTrackId = usePlayerStore((s) => s.currentTrackId);
  const isCommonPlay = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const restrictedRange = usePlayerStore((s) => (s.snippetMetadata ? s.snippetMetadata[effectiveId] : null) || null);
  const isDeleted = usePlayerStore((s) => !!s.deletedTracks[effectiveId]);

  // 4a. Uploads await their manifest snippet range before the waveform is meaningful.
  const isSnippetWaiting = isUpload && !restrictedRange && !isDeleted;

  // 4b. We treat the track as loading if the snippet metadata is awaited, 
  // or if the underlying peaks are still fetching.
  const isActuallyLoading = wfLoading || isSnippetWaiting;

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
    restrictedRange,
  });


  // 5a. Update custom peaks restricted range
  useEffect(() => {
    setRestrictedRange(restrictedRange);
  }, [restrictedRange, setRestrictedRange, effectiveId]);

  // 6. Playback helpers (optional)
  const isPlaying = isCommonPlay && currentTrackId === effectiveId;

  const togglePlay = useCallback(() => {
    if (!withPlayPause || isDeleted) return; // safeguard
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
  }, [withPlayPause, isDeleted, hlsController, isPlaying, currentTrackId, effectiveId]);

  // 7. Skip helpers (±10s)
  const skipBackward = useCallback(() => {
    if (!hlsController || isDeleted) return;
    const base = uiTime || 0;
    requestSeek(Math.max(0, base - 10));
  }, [hlsController, isDeleted, uiTime, requestSeek]);

  const skipForward = useCallback(() => {
    if (!hlsController || isDeleted) return;
    // For snippets, hlsController.getDuration() returns the audible snippet length (e.g. 60s)
    // while totalDuration is the original file length (e.g. 344s). We use the max to allow absolute skipping.
    const hlsDur = hlsController.getDuration();
    const d = (Number.isFinite(hlsDur) && hlsDur > 0) ? Math.max(hlsDur, totalDuration) : totalDuration;
    const base = uiTime || 0;
    requestSeek(Math.min(d, base + 10));
  }, [hlsController, isDeleted, uiTime, totalDuration, requestSeek]);

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
    wfLoading: isActuallyLoading,
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
    // preview (Apple Music) mode: no waveform — components render a simple progress line instead.
    isPreview,
    // The preview's OWN length (what the scrubber spans); the full track length is shown as metadata.
    getPlayableDuration: () => (hlsController?.getDuration?.() || 0),
    // Seek to an absolute time (used by the simple line's click-to-seek).
    seekTo: (t: number) => requestSeek(t),
  } as const;
}
