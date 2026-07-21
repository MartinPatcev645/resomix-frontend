/**
 * usePlaylistVisibility — toggle the CURRENTLY-VIEWED playlist's public/private state.
 *
 * For the Playlist hero (reference-track card). Calls the owner-only backend endpoint and, on
 * success, mirrors the new value into the playlist store (which also updates the localStorage
 * cache) so the hero + any cached copy stay in sync. The backend rejects a non-owner with 403;
 * that message is returned for the caller to surface.
 */
import { useCallback } from "react";
import { usePlaylistStore } from "@resomix/stores";
import { changePlaylistVisibility } from "@resomix/api-client";

export interface SetVisibilityResult {
  ok: boolean;
  error?: string;
}

export function usePlaylistVisibility() {
  const updatePublic = usePlaylistStore((s) => s.updatePlaylistPublicStatus);

  const setVisibility = useCallback(
    async (playlistId: string, isPublic: boolean): Promise<SetVisibilityResult> => {
      try {
        const resp = await changePlaylistVisibility(playlistId, isPublic);
        if (resp.success) {
          updatePublic(isPublic);
          return { ok: true };
        }
        return { ok: false, error: resp.error || "Failed to update visibility" };
      } catch (err: any) {
        return { ok: false, error: err?.message || "Failed to update visibility" };
      }
    },
    [updatePublic]
  );

  return { setVisibility };
}
