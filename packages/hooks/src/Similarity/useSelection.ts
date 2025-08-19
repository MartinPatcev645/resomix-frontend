import { useCallback } from "react";
import { getSimilarityForSelectedTrack } from "@resomix/api-client";
import { useUploadStore } from "./useUpload";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import type { UploadResult } from "./useUpload";

/**
 * Hook for retrieving similar tracks given a selected track ID (no file upload).
 * Mirrors the behaviour of `useUpload` so downstream pages can rely on the
 * same store (`useUploadStore`) for reading overlay / response / error state.
 */
export function useTrackSimilarity() {
  const {
    setUploading,
    setProgress,
    setError,
    setResponse,
    setOverlay,
    setIsFileUpload,
  } = useUploadStore();

  // Playlist store – we will save API response here
  const { setPlaylistResponse } = usePlaylistStore();
  
  // Get topSk from player store
  const { topSk } = usePlayerStore();

  // Since we are not actually uploading anything we will keep progress fixed
  // at 0 → 100 instantly. This keeps UI components that rely on the progress
  // value happy without showing a fictitious bar for too long.
  const handleSelectTrack = useCallback(
    async (trackId: string | number) => {
      if (!trackId) return;
      // Show overlay but keep progress at 0 (no actual upload)
      setOverlay(true);
      setUploading(false);
      setProgress(0);
      setError(null);
      setResponse(null);
      // Mark this as NOT a file upload (search selection)
      setIsFileUpload(false);

      try {
        const result = await getSimilarityForSelectedTrack(String(trackId), topSk);

        if (result && result.success) {
          // Success path
          setProgress(100);
          setResponse(result as UploadResult);
          setPlaylistResponse(result as any);
          // Hide overlay to allow navigation handled elsewhere
          setOverlay(false);
        } else {
          // API indicated failure – surface error and keep overlay to show banner
          setError(result?.error || "Failed to fetch similar tracks.");
          setOverlay(false);
        }
      } catch (err: any) {
        // Network / Axios error; show message, keep overlay so banner displays
        setError(err?.error || err?.message || "Failed to fetch similar tracks.");
        setOverlay(false);
      }
    },
    [setUploading, setProgress, setError, setResponse, setPlaylistResponse, setOverlay, setIsFileUpload, topSk],
  );

  return {
    handleSelectTrack,
  } as const;
}
