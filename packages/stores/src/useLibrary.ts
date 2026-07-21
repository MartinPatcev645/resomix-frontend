import { create } from 'zustand'

/** Analysis-derived display metrics for an uploaded track (null until the analysis lands). */
export interface LibraryTrackAnalysis {
  top_genre: string | null;
  bpm: number | null;
  music_key: string | null;
  scale: string | null;
  camelot: string | null;
}

export interface LibraryTrack {
  id: string;
  title: string;
  // Real values from the backend (contributors / release / label joins) — null when absent.
  // No fabricated defaults ("Unknown Artist" / "Independent") — the UI skips missing fields.
  artist: string | null;
  album: string | null;
  label: string | null;
  genre: string | null;
  duration_ms: number | null;
  // A non-null artifact uuid IS the "exists" signal (the old has_* booleans are gone).
  playlist_uuid?: string | null;
  analysis_uuid?: string | null;
  analysis?: LibraryTrackAnalysis | null;
  // Upload timestamp (ISO). Used by the Library to decide whether a still-missing sibling
  // artifact (analysis / playlist) is likely still generating and should be polled for.
  created_at?: string | null;
}

export interface LibraryPlaylist {
  id: string;
  uuid: string;
  name: string;
  is_public: boolean;
  trackCount: number;
  duration: string;
  createdAt: string;
}

export interface LibraryStore {
  // Three independent sections, each kept in the store so switching tabs is instant and every
  // tab's count stays visible. Favorites are held separately from the user's own playlists.
  playlists: LibraryPlaylist[];
  favorites: LibraryPlaylist[];
  tracks: LibraryTrack[];

  error: string | null;
  activeTab: 'playlists' | 'favorites' | 'tracks';

  // Per-section loading so the active tab shows its own spinner while the others load in background.
  playlistsLoading: boolean;
  favoritesLoading: boolean;
  tracksLoading: boolean;

  // Pagination & counts (per section)
  playlistsPage: number;
  playlistsTotalPages: number;
  playlistsTotal: number;

  favoritesPage: number;
  favoritesTotalPages: number;
  favoritesTotal: number;

  tracksPage: number;
  tracksTotalPages: number;
  tracksTotal: number;

  setPlaylists: (playlists: LibraryPlaylist[]) => void;
  setFavorites: (favorites: LibraryPlaylist[]) => void;
  setTracks: (tracks: LibraryTrack[]) => void;

  setPlaylistsLoading: (loading: boolean) => void;
  setFavoritesLoading: (loading: boolean) => void;
  setTracksLoading: (loading: boolean) => void;

  setError: (error: string | null) => void;
  setActiveTab: (tab: 'playlists' | 'favorites' | 'tracks') => void;

  setPlaylistsPagination: (page: number, totalPages: number, total: number) => void;
  setFavoritesPagination: (page: number, totalPages: number, total: number) => void;
  setTracksPagination: (page: number, totalPages: number, total: number) => void;

  reset: () => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  playlists: [],
  favorites: [],
  tracks: [],
  error: null,
  activeTab: 'playlists',

  playlistsLoading: false,
  favoritesLoading: false,
  tracksLoading: false,

  playlistsPage: 1,
  playlistsTotalPages: 1,
  playlistsTotal: 0,

  favoritesPage: 1,
  favoritesTotalPages: 1,
  favoritesTotal: 0,

  tracksPage: 1,
  tracksTotalPages: 1,
  tracksTotal: 0,

  setPlaylists: (playlists) => set({ playlists }),
  setFavorites: (favorites) => set({ favorites }),
  setTracks: (tracks) => set({ tracks }),

  setPlaylistsLoading: (playlistsLoading) => set({ playlistsLoading }),
  setFavoritesLoading: (favoritesLoading) => set({ favoritesLoading }),
  setTracksLoading: (tracksLoading) => set({ tracksLoading }),

  setError: (error) => set({ error }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setPlaylistsPagination: (playlistsPage, playlistsTotalPages, playlistsTotal) =>
    set({ playlistsPage, playlistsTotalPages, playlistsTotal }),
  setFavoritesPagination: (favoritesPage, favoritesTotalPages, favoritesTotal) =>
    set({ favoritesPage, favoritesTotalPages, favoritesTotal }),
  setTracksPagination: (tracksPage, tracksTotalPages, tracksTotal) =>
    set({ tracksPage, tracksTotalPages, tracksTotal }),

  reset: () => set({
    playlists: [],
    favorites: [],
    tracks: [],
    error: null,
    activeTab: 'playlists',
    playlistsLoading: false,
    favoritesLoading: false,
    tracksLoading: false,
    playlistsPage: 1,
    playlistsTotalPages: 1,
    playlistsTotal: 0,
    favoritesPage: 1,
    favoritesTotalPages: 1,
    favoritesTotal: 0,
    tracksPage: 1,
    tracksTotalPages: 1,
    tracksTotal: 0,
  }),
}));
