import { useCallback } from 'react';
import {
  useLibraryStore,
  clearPlaylistFromCache,
  EMPTY_LIBRARY_FILTERS,
  type LibraryPlaylist,
  type LibraryFilters,
} from '@resomix/stores';
import {
  getAllPlaylists,
  getMyTracks,
  deleteMyTrack,
  deleteMyPlaylist,
  changePlaylistVisibility,
  renamePlaylist as apiRenamePlaylist,
  addFavorite,
  removeFavorite,
  type UserPlaylistListParams,
  type MyTracksParams,
} from '@resomix/api-client';

/** Applied playlist filters → backend query params (blank/any bounds dropped). */
const toPlaylistParams = (f: LibraryFilters): UserPlaylistListParams => {
  const p: UserPlaylistListParams = {};
  if (f.search.trim()) p.search = f.search.trim();
  if (f.startDate) p.start_date = f.startDate;
  if (f.endDate) p.end_date = f.endDate;
  if (f.numTracks) p.num_tracks = f.numTracks;
  // Favorites-only = owned AND favorited (the tab lists the user's own playlists).
  if (f.favoritesOnly) p.own_favorites = true;
  return p;
};

/** Applied tracks filters → backend query params (blank/any bounds dropped). */
const toTrackParams = (f: LibraryFilters): MyTracksParams => {
  const p: MyTracksParams = {};
  if (f.search.trim()) p.search = f.search.trim();
  if (f.startDate) p.start_date = f.startDate;
  if (f.endDate) p.end_date = f.endDate;
  return p;
};

const formatDuration = (playTime?: number): string => {
  if (!playTime) return "0m";
  return playTime >= 3600
    ? `${Math.floor(playTime / 3600)}h ${Math.floor((playTime % 3600) / 60)}m`
    : `${Math.floor(playTime / 60)}m`;
};

const formatPlaylist = (p: any, index = 0): LibraryPlaylist => {
  // `is_visible` is absent on responses from before the cap was derived; treat that as unlocked
  // so an older backend cannot grey out someone's whole Library.
  const isVisible = p.is_visible !== false;
  return {
    // A locked playlist has no identifier, so React needs a key from somewhere. Positional, and
    // deliberately prefixed: it must never be mistaken for a uuid and passed to a route.
    id: isVisible ? String(p.id || p.uuid) : `locked-${index}`,
    uuid: isVisible ? (p.uuid || p.id) : null,
    name: p.name,
    is_public: p.is_public,
    is_favorite: !!p.is_favorite,
    trackCount: p.num_tracks || 0,
    duration: formatDuration(p.play_time),
    createdAt: p.created_at || new Date().toISOString(),
    seedTrackUuid: p.seed_track_uuid ?? null,
    hasCustomCover: !!p.has_custom_cover,
    isVisible,
  };
};

export function useLibrary() {
  const playlists = useLibraryStore(state => state.playlists);
  const tracks = useLibraryStore(state => state.tracks);
  const error = useLibraryStore(state => state.error);
  const activeTab = useLibraryStore(state => state.activeTab);

  const playlistsLoading = useLibraryStore(state => state.playlistsLoading);
  const tracksLoading = useLibraryStore(state => state.tracksLoading);

  const playlistsPage = useLibraryStore(state => state.playlistsPage);
  const playlistsTotalPages = useLibraryStore(state => state.playlistsTotalPages);
  const playlistsTotal = useLibraryStore(state => state.playlistsTotal);
  const playlistsLibraryTotal = useLibraryStore(state => state.playlistsLibraryTotal);
  const tracksPage = useLibraryStore(state => state.tracksPage);
  const tracksTotalPages = useLibraryStore(state => state.tracksTotalPages);
  const tracksTotal = useLibraryStore(state => state.tracksTotal);

  const setPlaylists = useLibraryStore(state => state.setPlaylists);
  const setTracks = useLibraryStore(state => state.setTracks);
  const setPlaylistsLoading = useLibraryStore(state => state.setPlaylistsLoading);
  const setTracksLoading = useLibraryStore(state => state.setTracksLoading);
  const setError = useLibraryStore(state => state.setError);
  const setActiveTab = useLibraryStore(state => state.setActiveTab);
  const setPlaylistsPagination = useLibraryStore(state => state.setPlaylistsPagination);
  const setTracksPagination = useLibraryStore(state => state.setTracksPagination);

  const playlistsFilters = useLibraryStore(state => state.playlistsFilters);
  const tracksFilters = useLibraryStore(state => state.tracksFilters);
  const setPlaylistsFilters = useLibraryStore(state => state.setPlaylistsFilters);
  const setTracksFilters = useLibraryStore(state => state.setTracksFilters);

  const reset = useLibraryStore(state => state.reset);

  const loadPlaylists = useCallback(async (page = 1, pageSize = 20) => {
    setPlaylistsLoading(true);
    setError(null);
    try {
      // Read the applied filters at call time so pagination + Refresh re-apply them.
      const filters = useLibraryStore.getState().playlistsFilters;
      const resp = await getAllPlaylists({ page, page_size: pageSize, ...toPlaylistParams(filters) });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        setPlaylists(resp.data.map((p: any, i: number) => formatPlaylist(p, i)));
        const total = (resp as any).total || 0;
        // Everything the user owns, hidden ones included — the denominator in "5 of 18 shown".
        const libraryTotal = (resp as any).library_total;
        setPlaylistsPagination(page, Math.max(1, Math.ceil(total / pageSize)), total, libraryTotal);
      } else {
        setError(resp.error || "Failed to load playlists");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load playlists");
    } finally {
      setPlaylistsLoading(false);
    }
  }, [setPlaylistsLoading, setError, setPlaylists, setPlaylistsPagination]);

  // `silent` refetches in place (for the 10s artifact poll) without toggling the tracks spinner,
  // so the list doesn't flash while we wait for a sibling analysis/playlist to finish generating.
  const loadTracks = useCallback(async (page = 1, pageSize = 20, opts?: { silent?: boolean }) => {
    if (!opts?.silent) setTracksLoading(true);
    setError(null);
    try {
      const limitPageSize = Math.min(pageSize, 20);
      const filters = useLibraryStore.getState().tracksFilters;
      const resp = await getMyTracks({ page, page_size: limitPageSize, ...toTrackParams(filters) });
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
          playlist_locked: !!t.playlist_locked,
          analysis_uuid: t.analysis_uuid || null,
          analysis: t.analysis || null,
          // Passed through as-is. Deliberately NOT defaulted to a `pending` shape: an older
          // backend that omits this must read as "no record", and a default of pending would put
          // every row into a poll for artifacts nothing is building.
          artifacts: t.artifacts || null,
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
        setPlaylists(state.playlists.filter(p => p.uuid !== uuid));
        // Decrement the owned-total too, or the Library would keep reading "4 of 18" after a
        // delete that made it 17.
        setPlaylistsPagination(
          state.playlistsPage,
          state.playlistsTotalPages,
          Math.max(0, state.playlistsTotal - 1),
          Math.max(0, state.playlistsLibraryTotal - 1),
        );
        return { success: true };
      }
      return { success: false, error: (resp as any).error || "Failed to delete playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete playlist" };
    }
  }, [setPlaylists, setPlaylistsPagination]);

  /**
   * Toggle a playlist's favorite state (the row heart). Optimistic: flips is_favorite immediately
   * and reverts on failure. When the favorites-only filter is active, un-favoriting drops the row
   * from the list on success (it no longer matches the view).
   */
  const toggleFavorite = useCallback(async (uuid: string, makeFavorite: boolean) => {
    const setFav = (val: boolean) => {
      const s = useLibraryStore.getState();
      setPlaylists(s.playlists.map(p => p.uuid === uuid ? { ...p, is_favorite: val } : p));
    };
    setFav(makeFavorite); // optimistic
    try {
      const resp = makeFavorite ? await addFavorite(uuid) : await removeFavorite(uuid);
      if (resp && (resp as any).success) {
        // Drop any cached copy so the playlist hero heart isn't stale next open.
        clearPlaylistFromCache(uuid);
        const after = useLibraryStore.getState();
        if (!makeFavorite && after.playlistsFilters.favoritesOnly) {
          setPlaylists(after.playlists.filter(p => p.uuid !== uuid));
          setPlaylistsPagination(
            after.playlistsPage,
            after.playlistsTotalPages,
            Math.max(0, after.playlistsTotal - 1),
            Math.max(0, after.playlistsLibraryTotal - 1),
          );
        }
        return { success: true };
      }
      setFav(!makeFavorite); // revert
      return { success: false, error: (resp as any)?.error || "Failed to update favorite" };
    } catch (err: any) {
      setFav(!makeFavorite); // revert
      return { success: false, error: err.message || "Failed to update favorite" };
    }
  }, [setPlaylists, setPlaylistsPagination]);

  /** Owner-only visibility toggle for a library playlist (public↔private), optimistic on success. */
  const setPlaylistVisibility = useCallback(async (uuid: string, isPublic: boolean) => {
    try {
      const resp = await changePlaylistVisibility(uuid, isPublic);
      if (resp.success) {
        const state = useLibraryStore.getState();
        setPlaylists(state.playlists.map(p => p.uuid === uuid ? { ...p, is_public: isPublic } : p));
        return { success: true };
      }
      return { success: false, error: resp.error || "Failed to update visibility" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to update visibility" };
    }
  }, [setPlaylists]);

  // Sharing = ensure the playlist is public. Thin wrapper over setPlaylistVisibility.
  const sharePlaylist = useCallback(
    (uuid: string) => setPlaylistVisibility(uuid, true),
    [setPlaylistVisibility]
  );

  /** Rename an owned library playlist; optimistically updates the name in the list on success. */
  const renamePlaylist = useCallback(async (uuid: string, newName: string) => {
    try {
      const resp = await apiRenamePlaylist(uuid, newName);
      if (resp.success) {
        // Drop any cached copy so the playlist hero shows the new name on next open.
        clearPlaylistFromCache(uuid);
        const state = useLibraryStore.getState();
        setPlaylists(state.playlists.map(p => p.uuid === uuid ? { ...p, name: newName } : p));
        return { success: true };
      }
      return { success: false, error: (resp as any).error || "Failed to rename playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to rename playlist" };
    }
  }, [setPlaylists]);

  /**
   * Reflect a cover that was just replaced from the library's rename modal: flip `hasCustomCover`
   * on the row and bump its cache-buster so the thumbnail re-fetches (the URL is otherwise
   * identical). Also drops the cached playlist so the playlist page shows the new cover on next
   * open. The upload itself is done by `usePlaylistCover`; this only syncs the list.
   */
  const markPlaylistCoverUpdated = useCallback((uuid: string) => {
    clearPlaylistFromCache(uuid);
    const state = useLibraryStore.getState();
    setPlaylists(
      state.playlists.map(p =>
        p.uuid === uuid ? { ...p, hasCustomCover: true, coverBust: Date.now() } : p,
      ),
    );
  }, [setPlaylists]);

  // Commit a tab's filters and reload from page 1. Store `set` is synchronous, so the
  // load* call below reads the just-set filters via getState().
  //
  // `reload: false` commits the filters without fetching. The Library's URL now drives its own
  // loads, so when filtering also moves the URL back to page 1 that move issues the request —
  // and both doing it would fire two identical fetches back to back. The default stays `true`,
  // so any caller that is not managing its own loads behaves exactly as before.
  const applyFilters = useCallback((
    tab: 'playlists' | 'tracks',
    filters: LibraryFilters,
    opts?: { reload?: boolean },
  ) => {
    const reload = opts?.reload !== false;
    if (tab === 'tracks') {
      setTracksFilters(filters);
      if (reload) loadTracks(1);
    } else {
      setPlaylistsFilters(filters);
      if (reload) loadPlaylists(1);
    }
  }, [setTracksFilters, setPlaylistsFilters, loadTracks, loadPlaylists]);

  /** Reset a tab's filters to empty and reload. */
  const clearFilters = useCallback((tab: 'playlists' | 'tracks') => {
    applyFilters(tab, { ...EMPTY_LIBRARY_FILTERS });
  }, [applyFilters]);

  return {
    playlists,
    tracks,
    error,
    activeTab,
    playlistsLoading,
    tracksLoading,
    playlistsPage,
    playlistsTotalPages,
    playlistsTotal,
    playlistsLibraryTotal,
    tracksPage,
    tracksTotalPages,
    tracksTotal,
    setActiveTab,
    loadPlaylists,
    loadTracks,
    removeTrack,
    removePlaylist,
    toggleFavorite,
    sharePlaylist,
    setPlaylistVisibility,
    renamePlaylist,
    markPlaylistCoverUpdated,
    // Filters (applied, per tab) + actions.
    playlistsFilters,
    tracksFilters,
    applyFilters,
    clearFilters,
    reset,
  };
}
