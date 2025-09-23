import { useCallback } from "react";
import { getSimilarityForSelectedTrack } from "@resomix/api-client";
import { useUploadStore } from "./useUpload";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import type { UploadResult } from "./useUpload";
import { useTermsAcceptance } from "../useTermsAcceptance";
import { BASE_BETA_URL } from "@resomix/config";

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
  
  // Terms acceptance hook
  const { checkTermsAcceptance } = useTermsAcceptance();

  const handleSelectTrack = useCallback(
    async (trackId: string | number, parameter: boolean = false) => {
      console.log("🎵 handleSelectTrack called with:", { trackId, parameter });
      
      if (!trackId) {
        console.log("❌ No trackId provided, returning");
        return;
      }
      
      console.log("🔄 Resetting state...");
      // Reset state first
      setError(null);
      setResponse(null);
      setProgress(0);
      setUploading(false);
      setIsFileUpload(false);
      
      console.log("🔍 Checking terms acceptance...");
      // Check terms acceptance before proceeding (don't show overlay yet)
      const termsAccepted = await checkTermsAcceptance();
      console.log("📋 Terms acceptance result:", termsAccepted);
      
      if (!termsAccepted) {
        console.log("❌ Terms not accepted");
        // User dismissed terms without accepting
        if (parameter) {
          console.log("🔄 Redirecting to BASE_BETA_URL because parameter=true");
          // Only redirect if they came via URL parameter
          window.location.href = BASE_BETA_URL;
        } else {
          console.log("🚫 Not redirecting because parameter=false");
        }
        return;
      }
      
      console.log("✅ Terms accepted, showing overlay and proceeding...");
      // Now show overlay after terms are accepted
      setOverlay(true);

      try {
        console.log("🚀 Making API call to getSimilarityForSelectedTrack...");
        const result = await getSimilarityForSelectedTrack(String(trackId), topSk);
        console.log("📡 API response received:", result);

        if (result && result.success) {
          console.log("✅ API call successful");
          // Success path
          setProgress(100);
          setResponse(result as UploadResult);
          setPlaylistResponse(result as any);
          // Hide overlay to allow navigation handled elsewhere
          setOverlay(false);
          console.log("🎉 Success flow completed");
        } else {
          console.log("❌ API call failed:", result?.error);
          // API indicated failure – surface error and keep overlay to show banner
          setError(result?.error || "Failed to fetch similar tracks.");
          setOverlay(false);
        }
      } catch (err: any) {
        console.log("💥 API call threw error:", err);
        // Network / Axios error; show message, keep overlay so banner displays
        setError(err?.error || err?.message || "Failed to fetch similar tracks.");
        setOverlay(false);
      }
    },
    [setUploading, setProgress, setError, setResponse, setPlaylistResponse, setOverlay, setIsFileUpload, topSk, checkTermsAcceptance],
  );

  return {
    handleSelectTrack,
  } as const;
}
