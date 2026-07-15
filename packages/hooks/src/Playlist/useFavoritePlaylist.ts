/**
 * useFavoritePlaylist
 * ===================
 *
 * Single source for the "favorite / unfavorite the currently-viewed playlist" action, so the
 * desktop and mobile `PlaylistHero` stay in sync. Seeds the heart from the server-provided
 * `is_favorite` (present for logged-in users; guests always see `false`), toggles optimistically,
 * persists via the backend, and mirrors the result into the store + localStorage cache so the
 * heart stays correct on later navigation.
 *
 * Favoriting requires a logged-in account (the backend endpoint is auth-only), so guests get a
 * `gated` result the caller turns into a login prompt. The backend also rejects favoriting a
 * guest-created playlist (403) — that message is surfaced verbatim via `error`.
 */

import { useCallback, useEffect, useState } from "react";
import { usePlaylistStore, useAuthStore } from "@resomix/stores";
import { addFavorite, removeFavorite } from "@resomix/api-client";

export interface ToggleFavoriteResult {
  ok: boolean;
  /** True when the action needs a login (guest) — caller should show a login prompt. */
  gated?: boolean;
  /** Human-readable error to surface (e.g. the guest-playlist 403 message). */
  error?: string;
}

export interface UseFavoritePlaylistResult {
  isFavorite: boolean;
  /** True while a toggle request is in flight. */
  pending: boolean;
  toggleFavorite: () => Promise<ToggleFavoriteResult>;
}

export function useFavoritePlaylist(): UseFavoritePlaylistResult {
  const playlistData = usePlaylistStore((s) => s.playlistData);
  const updateFavorite = usePlaylistStore((s) => s.updatePlaylistFavoriteStatus);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const playlistId = playlistData?.playlist?.id;
  const serverFavorite = !!playlistData?.playlist?.is_favorite;

  const [isFavorite, setIsFavorite] = useState(serverFavorite);
  const [pending, setPending] = useState(false);

  // Re-seed whenever the playlist (or its server favorite flag) changes.
  useEffect(() => {
    setIsFavorite(serverFavorite);
  }, [playlistId, serverFavorite]);

  const toggleFavorite = useCallback(async (): Promise<ToggleFavoriteResult> => {
    if (!isAuthenticated) {
      return { ok: false, gated: true };
    }
    if (!playlistId || pending) {
      return { ok: false };
    }

    const next = !isFavorite;
    setPending(true);
    setIsFavorite(next); // optimistic

    try {
      const resp = next ? await addFavorite(playlistId) : await removeFavorite(playlistId);
      if (resp && (resp as { success?: boolean }).success) {
        updateFavorite?.(next);
        return { ok: true };
      }
      // Revert and surface the backend message (e.g. the guest-playlist 403).
      setIsFavorite(!next);
      return { ok: false, error: (resp as { error?: string })?.error || "Could not update favorite. Please try again." };
    } catch (err) {
      setIsFavorite(!next);
      return { ok: false, error: (err as Error)?.message || "Could not update favorite. Please try again." };
    } finally {
      setPending(false);
    }
  }, [isAuthenticated, playlistId, pending, isFavorite, updateFavorite]);

  return { isFavorite, pending, toggleFavorite };
}
