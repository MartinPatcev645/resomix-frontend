import { useCallback } from "react";
import { getSimilarityForSelectedTrack, initDeviceHash } from "@resomix/api-client";
// import { waitForSegmentation } from "@resomix/api-client"; // Commented out - segmentation polling no longer needed
import { useUploadStore } from "./useUpload";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import type { UploadResult } from "./useUpload";
import { useTermsAcceptance } from "../useTermsAcceptance";
import { BASE_BETA_URL } from "@resomix/config";
import { mapPlaylistErrorMessage } from "../Playlist/errorMessages";

/**
 * Called with analysis stats when a similarity request succeeds.
 * resultCount: number of similar tracks returned.
 * topMatchScore: highest score (0–1) in the results.
 * analysisSeconds: elapsed seconds, capped at 1.97 for search/popular flow.
 */
export interface SelectionAnalysisStats {
  resultCount: number;
  topMatchScore: number;
  analysisSeconds: number;
}

export interface TrackSimilarityOptions {
  onAnalysis?: (playlistId: string, stats: SelectionAnalysisStats) => void;
}

/**
 * Hook for retrieving similar tracks given a selected track ID (no file upload).
 * Mirrors the behaviour of `useUpload` so downstream pages can rely on the
 * same store (`useUploadStore`) for reading overlay / response / error state.
 */
export function useTrackSimilarity(options?: TrackSimilarityOptions) {
  const { onAnalysis } = options ?? {};
  const {
    setUploading,
    setProgress,
    setError,
    setResponse,
    setOverlay,
    setIsFileUpload,
    setGateReason,
  } = useUploadStore();

  // Playlist store – we will save API response here
  const { setPlaylistResponse } = usePlaylistStore();

  // Get topSk from player store
  const { topSk } = usePlayerStore();

  // Terms acceptance hook
  const { checkTermsAcceptance } = useTermsAcceptance();

  const handleSelectTrack = useCallback(
    async (trackId: string | number, parameter: boolean = false) => {
      if (!trackId) return;

      // Reset state first
      setError(null);
      setGateReason(null);
      setResponse(null);
      setProgress(0);
      setUploading(false);
      setIsFileUpload(false);

      // Check terms acceptance before proceeding (don't show overlay yet)
      const termsAccepted = await checkTermsAcceptance();

      if (!termsAccepted) {
        // User dismissed terms without accepting
        if (parameter) {
          // Only redirect if they came via URL parameter
          window.location.href = BASE_BETA_URL;
        }
        return;
      }

      // Now show overlay after terms are accepted
      setOverlay(true);
      const requestStart = Date.now();

      try {
        // Ensure the guest device hash is ready BEFORE the first search so the created playlist is
        // tagged with the stable visitor_id (otherwise the first one can't be reparented on login).
        await initDeviceHash();
        const result = await getSimilarityForSelectedTrack(String(trackId), topSk);

        if (result && result.success) {
          // Success path
          setProgress(100);
          setResponse(result as UploadResult);
          setPlaylistResponse(result as any, false);

          // Fire analysis callback if provided
          if (onAnalysis) {
            const playlistId: string = (result as any).data?.playlist?.id ?? '';
            const similarTracks: Array<{ score: number }> = (result as any).data?.similar_tracks ?? [];
            const elapsedSeconds = (Date.now() - requestStart) / 1000;
            const analysisSeconds = Math.min(elapsedSeconds, 1.97);
            const topMatchScore = similarTracks.length > 0
              ? Math.max(...similarTracks.map((t) => t.score))
              : 0;
            if (playlistId) {
              onAnalysis(playlistId, {
                resultCount: similarTracks.length,
                topMatchScore,
                analysisSeconds,
              });
            }
          }
        } else {
          // API indicated failure. A soft entitlement gate (daily limit / plan cap) drives a
          // login/subscribe CTA rather than a generic error banner.
          const reason = (result as { reason?: string } | null)?.reason;
          if (reason === "login_required" || reason === "upgrade_required") {
            setGateReason(reason);
          } else {
            setError(mapPlaylistErrorMessage(result?.error, "Failed to fetch similar tracks."));
          }
          setOverlay(false);
        }
      } catch (err: any) {
        // Network / Axios error (or a gate surfaced as a thrown error).
        if (err?.reason === "login_required" || err?.reason === "upgrade_required") {
          setGateReason(err.reason);
        } else {
          setError(mapPlaylistErrorMessage(err?.error || err?.message, "Failed to fetch similar tracks."));
        }
        setOverlay(false);
      }
    },
    [setUploading, setProgress, setError, setResponse, setPlaylistResponse, setOverlay, setIsFileUpload, topSk, checkTermsAcceptance, onAnalysis],
  );

  return {
    handleSelectTrack,
  } as const;
}
