import { useCallback } from 'react';
import { useLibraryStore, clearPlaylistFromCache, type LibraryPlaylist } from '@resomix/stores';
import {
  getAllPlaylists,
  getMyTracks,
  deleteMyTrack,
  deleteMyPlaylist,
  changePlaylistVisibility,
  renamePlaylist as apiRenamePlaylist,
  removeFavorite
} from '@resomix/api-client';

const formatDuration = (playTime?: number): string => {
  if (!playTime) return "0m";
  return playTime >= 3600
    ? `${Math.floor(playTime / 3600)}h ${Math.floor((playTime % 3600) / 60)}m`
    : `${Math.floor(playTime / 60)}m`;
};

const formatPlaylist = (p: any): LibraryPlaylist => ({
  id: String(p.id || p.uuid),
  uuid: p.uuid || p.id,
  name: p.name,
  is_public: p.is_public,
  trackCount: p.num_tracks || 0,
  duration: formatDuration(p.play_time),
  createdAt: p.created_at || new Date().toISOString(),
});

export function useLibrary() {
  const playlists = useLibraryStore(state => state.playlists);
  const favorites = useLibraryStore(state => state.favorites);
  const tracks = useLibraryStore(state => state.tracks);
  const error = useLibraryStore(state => state.error);
  const activeTab = useLibraryStore(state => state.activeTab);

  const playlistsLoading = useLibraryStore(state => state.playlistsLoading);
  const favoritesLoading = useLibraryStore(state => state.favoritesLoading);
  const tracksLoading = useLibraryStore(state => state.tracksLoading);

  const playlistsPage = useLibraryStore(state => state.playlistsPage);
  const playlistsTotalPages = useLibraryStore(state => state.playlistsTotalPages);
  const playlistsTotal = useLibraryStore(state => state.playlistsTotal);
  const favoritesPage = useLibraryStore(state => state.favoritesPage);
  const favoritesTotalPages = useLibraryStore(state => state.favoritesTotalPages);
  const favoritesTotal = useLibraryStore(state => state.favoritesTotal);
  const tracksPage = useLibraryStore(state => state.tracksPage);
  const tracksTotalPages = useLibraryStore(state => state.tracksTotalPages);
  const tracksTotal = useLibraryStore(state => state.tracksTotal);

  const setPlaylists = useLibraryStore(state => state.setPlaylists);
  const setFavorites = useLibraryStore(state => state.setFavorites);
  const setTracks = useLibraryStore(state => state.setTracks);
  const setPlaylistsLoading = useLibraryStore(state => state.setPlaylistsLoading);
  const setFavoritesLoading = useLibraryStore(state => state.setFavoritesLoading);
  const setTracksLoading = useLibraryStore(state => state.setTracksLoading);
  const setError = useLibraryStore(state => state.setError);
  const setActiveTab = useLibraryStore(state => state.setActiveTab);
  const setPlaylistsPagination = useLibraryStore(state => state.setPlaylistsPagination);
  const setFavoritesPagination = useLibraryStore(state => state.setFavoritesPagination);
  const setTracksPagination = useLibraryStore(state => state.setTracksPagination);
  const reset = useLibraryStore(state => state.reset);

  const loadPlaylists = useCallback(async (page = 1, pageSize = 20) => {
    setPlaylistsLoading(true);
    setError(null);
    try {
      const resp = await getAllPlaylists({ page, page_size: pageSize });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        setPlaylists(resp.data.map(formatPlaylist));
        const total = (resp as any).total || 0;
        setPlaylistsPagination(page, Math.max(1, Math.ceil(total / pageSize)), total);
      } else {
        setError(resp.error || "Failed to load playlists");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load playlists");
    } finally {
      setPlaylistsLoading(false);
    }
  }, [setPlaylistsLoading, setError, setPlaylists, setPlaylistsPagination]);

  const loadFavorites = useCallback(async (page = 1, pageSize = 20) => {
    setFavoritesLoading(true);
    setError(null);
    try {
      const resp = await getAllPlaylists({ page, page_size: pageSize, all_favorites: true });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        setFavorites(resp.data.map(formatPlaylist));
        const total = (resp as any).total || 0;
        setFavoritesPagination(page, Math.max(1, Math.ceil(total / pageSize)), total);
      } else {
        setError(resp.error || "Failed to load favorites");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load favorites");
    } finally {
      setFavoritesLoading(false);
    }
  }, [setFavoritesLoading, setError, setFavorites, setFavoritesPagination]);

  // `silent` refetches in place (for the 10s artifact poll) without toggling the tracks spinner,
  // so the list doesn't flash while we wait for a sibling analysis/playlist to finish generating.
  const loadTracks = useCallback(async (page = 1, pageSize = 20, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setTracksLoading(true);
    setError(null);
    try {
      const limitPageSize = Math.min(pageSize, 20);
      const resp = await getMyTracks({ page, page_size: limitPageSize });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        // Real backend values only (reshaped response, 2026-07-22) — no fabricated
        // "Unknown Artist"/"Independent" placeholders; the UI simply skips absent fields.
        const formattedTracks = resp.data.map((t: any) => ({
          id: t.uuid,
          title: t.title || "Unknown Track",
          artist: t.artist || null,
          album: t.album || null,
          label: t.label || null,
          genre: t.genre || null,
          duration_ms: t.duration_ms ?? null,
          playlist_uuid: t.playlist_uuid || null,
          analysis_uuid: t.analysis_uuid || null,
          analysis: t.analysis || null,
          created_at: t.created_at || null,
        }));
        setTracks(formattedTracks);
        const total = (resp as any).total || 0;
        const totalPages = (resp as any).total_pages || Math.max(1, Math.ceil(total / limitPageSize));
        setTracksPagination(page, totalPages, total);
      } else {
        setError(resp.error || "Failed to load tracks");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load tracks");
    } finally {
      if (!opts?.silent) setTracksLoading(false);
    }
  }, [setTracksLoading, setError, setTracks, setTracksPagination]);

  const removeTrack = useCallback(async (uuid: string) => {
    try {
      const track = useLibraryStore.getState().tracks.find(t => t.id === uuid);
      const playlistUuid = track?.playlist_uuid;

      const resp = await deleteMyTrack(uuid);
      if (resp.success) {
        if (playlistUuid) {
          clearPlaylistFromCache(playlistUuid);
        }
        const currentTracks = useLibraryStore.getState().tracks;
        const currentTracksPage = useLibraryStore.getState().tracksPage;
        const currentTracksTotalPages = useLibraryStore.getState().tracksTotalPages;
        const currentTracksTotal = useLibraryStore.getState().tracksTotal;

        setTracks(currentTracks.filter(t => t.id !== uuid));
        setTracksPagination(
          currentTracksPage,
          currentTracksTotalPages,
          Math.max(0, currentTracksTotal - 1)
        );
        // Reload playlists to reflect cascaded deletion of generated playlists
        loadPlaylists(playlistsPage);
        return { success: true };
      }
      return { success: false, error: resp.error || "Failed to delete track" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete track" };
    }
  }, [setTracks, setTracksPagination, loadPlaylists, playlistsPage]);

  const removePlaylist = useCallback(async (uuid: string) => {
    try {
      const resp = await deleteMyPlaylist(uuid);
      if (resp.success) {
        clearPlaylistFromCache(uuid);
        const state = useLibraryStore.getState();

        // Drop from both the owned-playlists and favorites lists (a deletion is global).
        setPlaylists(state.playlists.filter(p => p.uuid !== uuid));
        setPlaylistsPagination(state.playlistsPage, state.playlistsTotalPages, Math.max(0, state.playlistsTotal - 1));
        if (state.favorites.some(p => p.uuid === uuid)) {
          setFavorites(state.favorites.filter(p => p.uuid !== uuid));
          setFavoritesPagination(state.favoritesPage, state.favoritesTotalPages, Math.max(0, state.favoritesTotal - 1));
        }
        return { success: true };
      }
      return { success: false, error: (resp as any).error || "Failed to delete playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete playlist" };
    }
  }, [setPlaylists, setPlaylistsPagination, setFavorites, setFavoritesPagination]);

  // Remove a playlist from the user's favorites (Favorites tab). On success the row is dropped from
  // the favorites list; the owned-playlists list is untouched.
  const removeFavoritePlaylist = useCallback(async (uuid: string) => {
    try {
      const resp = await removeFavorite(uuid);
      if (resp && (resp as any).success) {
        // Drop any cached copy so this playlist's hero heart isn't stale (shows favorited) next open.
        clearPlaylistFromCache(uuid);
        const state = useLibraryStore.getState();
        setFavorites(state.favorites.filter(p => p.uuid !== uuid));
        setFavoritesPagination(
          state.favoritesPage,
          state.favoritesTotalPages,
          Math.max(0, state.favoritesTotal - 1)
        );
        return { success: true };
      }
      return { success: false, error: (resp as any)?.error || "Failed to remove favorite" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to remove favorite" };
    }
  }, [setFavorites, setFavoritesPagination]);

  /** Owner-only visibility toggle for a library playlist (public↔private), optimistic on success. */
  const setPlaylistVisibility = useCallback(async (uuid: string, isPublic: boolean) => {
    try {
      const resp = await changePlaylistVisibility(uuid, isPublic);
      if (resp.success) {
        const state = useLibraryStore.getState();
        const mark = (list: LibraryPlaylist[]) => list.map(p => p.uuid === uuid ? { ...p, is_public: isPublic } : p);
        setPlaylists(mark(state.playlists));
        setFavorites(mark(state.favorites));
        return { success: true };
      }
      return { success: false, error: resp.error || "Failed to update visibility" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update visibility" };
    }
  }, [setPlaylists, setFavorites]);

  // Sharing = ensure the playlist is public. Thin wrapper over setPlaylistVisibility.
  const sharePlaylist = useCallback(
    (uuid: string) => setPlaylistVisibility(uuid, true),
    [setPlaylistVisibility]
  );

  /** Rename an owned library playlist; optimistically updates the name in both lists on success. */
  const renamePlaylist = useCallback(async (uuid: string, newName: string) => {
    try {
      const resp = await apiRenamePlaylist(uuid, newName);
      if (resp.success) {
        // Drop any cached copy so the playlist hero shows the new name on next open.
        clearPlaylistFromCache(uuid);
        const state = useLibraryStore.getState();
        const rename = (list: LibraryPlaylist[]) =>
          list.map(p => p.uuid === uuid ? { ...p, name: newName } : p);
        setPlaylists(rename(state.playlists));
        setFavorites(rename(state.favorites));
        return { success: true };
      }
      return { success: false, error: (resp as any).error || "Failed to rename playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to rename playlist" };
    }
  }, [setPlaylists, setFavorites]);

  return {
    playlists,
    favorites,
    tracks,
    error,
    activeTab,
    playlistsLoading,
    favoritesLoading,
    tracksLoading,
    playlistsPage,
    playlistsTotalPages,
    playlistsTotal,
    favoritesPage,
    favoritesTotalPages,
    favoritesTotal,
    tracksPage,
    tracksTotalPages,
    tracksTotal,
    setActiveTab,
    loadPlaylists,
    loadFavorites,
    loadTracks,
    removeTrack,
    removePlaylist,
    removeFavoritePlaylist,
    sharePlaylist,
    setPlaylistVisibility,
    renamePlaylist,
    reset,
  };
}
