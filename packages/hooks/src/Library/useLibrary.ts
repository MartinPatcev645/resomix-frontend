import { useCallback } from 'react';
import { useLibraryStore } from '@resomix/stores';
import { 
  getAllPlaylists, 
  getMyTracks, 
  deleteMyTrack, 
  deleteMyPlaylist,
  changePlaylistVisibility
} from '@resomix/api-client';

export function useLibrary() {
  const playlists = useLibraryStore(state => state.playlists);
  const tracks = useLibraryStore(state => state.tracks);
  const loading = useLibraryStore(state => state.loading);
  const error = useLibraryStore(state => state.error);
  const activeTab = useLibraryStore(state => state.activeTab);
  const playlistsPage = useLibraryStore(state => state.playlistsPage);
  const playlistsTotalPages = useLibraryStore(state => state.playlistsTotalPages);
  const playlistsTotal = useLibraryStore(state => state.playlistsTotal);
  const tracksPage = useLibraryStore(state => state.tracksPage);
  const tracksTotalPages = useLibraryStore(state => state.tracksTotalPages);
  const tracksTotal = useLibraryStore(state => state.tracksTotal);

  const setPlaylists = useLibraryStore(state => state.setPlaylists);
  const setTracks = useLibraryStore(state => state.setTracks);
  const setLoading = useLibraryStore(state => state.setLoading);
  const setError = useLibraryStore(state => state.setError);
  const setActiveTab = useLibraryStore(state => state.setActiveTab);
  const setPlaylistsPagination = useLibraryStore(state => state.setPlaylistsPagination);
  const setTracksPagination = useLibraryStore(state => state.setTracksPagination);
  const reset = useLibraryStore(state => state.reset);

  const loadPlaylists = useCallback(async (page = 1, pageSize = 20, filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAllPlaylists({ page, page_size: pageSize, ...filters });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        const formattedPlaylists = resp.data.map((p: any) => ({
          id: String(p.id || p.uuid),
          uuid: p.uuid || p.id,
          name: p.name,
          is_public: p.is_public,
          trackCount: p.num_tracks || 0,
          duration: p.play_time ? (p.play_time >= 3600 ? `${Math.floor(p.play_time / 3600)}h ${Math.floor((p.play_time % 3600) / 60)}m` : `${Math.floor(p.play_time / 60)}m`) : "0m",
          createdAt: p.created_at || new Date().toISOString(),
        }));
        setPlaylists(formattedPlaylists);
        const total = (resp as any).total || 0;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        setPlaylistsPagination(page, totalPages, total);
      } else {
        setError(resp.error || "Failed to load playlists");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load playlists");
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError, setPlaylists, setPlaylistsPagination]);

  const loadTracks = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const limitPageSize = Math.min(pageSize, 20);
      const resp = await getMyTracks({ page, page_size: limitPageSize });
      if (resp.success && resp.data && Array.isArray(resp.data)) {
        const formattedTracks = resp.data.map((t: any) => ({
          id: t.uuid,
          title: t.title || "Unknown Track",
          artist: t.display_artist || "Unknown Artist",
          year: t.created_at ? new Date(t.created_at).getFullYear() : 2026,
          label: t.version_title || "Independent",
          duration: t.duration ? `${Math.floor(t.duration / 60)}:${String(Math.floor(t.duration % 60)).padStart(2, "0")}` : "0:00",
          playlist_uuid: t.playlist_uuid || null,
          has_analysis: !!t.has_analysis,
          has_similarity: !!t.has_similarity,
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
      setLoading(false);
    }
  }, [setLoading, setError, setTracks, setTracksPagination]);

  const removeTrack = useCallback(async (uuid: string) => {
    try {
      const resp = await deleteMyTrack(uuid);
      if (resp.success) {
        const currentTracks = useLibraryStore.getState().tracks;
        const currentTracksPage = useLibraryStore.getState().tracksPage;
        const currentTracksTotalPages = useLibraryStore.getState().tracksTotalPages;
        const currentTracksTotal = useLibraryStore.getState().tracksTotal;

        const updatedTracks = currentTracks.filter(t => t.id !== uuid);
        setTracks(updatedTracks);
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
        const currentPlaylists = useLibraryStore.getState().playlists;
        const currentPlaylistsPage = useLibraryStore.getState().playlistsPage;
        const currentPlaylistsTotalPages = useLibraryStore.getState().playlistsTotalPages;
        const currentPlaylistsTotal = useLibraryStore.getState().playlistsTotal;

        const updatedPlaylists = currentPlaylists.filter(p => p.uuid !== uuid);
        setPlaylists(updatedPlaylists);
        setPlaylistsPagination(
          currentPlaylistsPage,
          currentPlaylistsTotalPages,
          Math.max(0, currentPlaylistsTotal - 1)
        );
        return { success: true };
      }
      return { success: false, error: (resp as any).error || "Failed to delete playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to delete playlist" };
    }
  }, [setPlaylists, setPlaylistsPagination]);

  const sharePlaylist = useCallback(async (uuid: string) => {
    try {
      const resp = await changePlaylistVisibility(uuid, true);
      if (resp.success) {
        const currentPlaylists = useLibraryStore.getState().playlists;
        const updatedPlaylists = currentPlaylists.map(p => 
          p.uuid === uuid ? { ...p, is_public: true } : p
        );
        setPlaylists(updatedPlaylists);
        return { success: true };
      }
      return { success: false, error: resp.error || "Failed to share playlist" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to share playlist" };
    }
  }, [setPlaylists]);

  return {
    playlists,
    tracks,
    loading,
    error,
    activeTab,
    playlistsPage,
    playlistsTotalPages,
    playlistsTotal,
    tracksPage,
    tracksTotalPages,
    tracksTotal,
    setActiveTab,
    loadPlaylists,
    loadTracks,
    removeTrack,
    removePlaylist,
    sharePlaylist,
    reset,
  };
}
