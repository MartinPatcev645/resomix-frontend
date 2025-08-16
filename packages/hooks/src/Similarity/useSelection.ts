import { useCallback } from "react";
import { getSimilarityForSelectedTrack } from "@resomix/api-client";
import { useUploadStore } from "./useUpload";
import { usePlaylistStore } from "@resomix/stores";
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

  // Since we are not actually uploading anything we will keep progress fixed
  // at 0 → 100 instantly. This keeps UI components that rely on the progress
  // value happy without showing a fictitious bar for too long.
  const handleSelectTrack = useCallback(
    async (trackId: string | number, topSk = 20) => {
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
        // No progress events – just jump to 100 % when done
        setProgress(100);
        setResponse(result as UploadResult);

        // Persist to playlist store; the page component will handle navigation
        setPlaylistResponse(result as any);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch similar tracks.");
      }
    },
    [setUploading, setProgress, setError, setResponse, setPlaylistResponse, setOverlay, setIsFileUpload],
  );

  return {
    handleSelectTrack,
  } as const;
}
