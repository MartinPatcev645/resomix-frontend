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
  // Favorite state is surfaced inline (heart toggle) on the Playlists tab — there's no separate
  // Favorites tab. Toggling flips this optimistically.
  is_favorite: boolean;
  trackCount: number;
  duration: string;
  createdAt: string;
  // Seed track uuid — the frontend builds the media-server cover URL from it (like peaks). null →
  // the UI shows the bundled default cover.
  seedTrackUuid?: string | null;
  // True → a custom playlist cover was uploaded; the thumbnail fetches it by the playlist `uuid`
  // (else it shows the bundled default — a playlist never uses a track's own cover).
  hasCustomCover?: boolean;
  // Cache-buster, bumped after the cover is replaced from the library so the thumbnail re-fetches
  // the same URL instead of showing the previous image.
  coverBust?: number;
}

/** Applied filters for a library section. `numTracks` + `favoritesOnly` are playlists-only. */
export interface LibraryFilters {
  /** Free-text: title/artist/uuid (tracks) or name/uuid (playlists). */
  search: string;
  /** Inclusive date range (YYYY-MM-DD); either bound may be empty. */
  startDate: string;
  endDate: string;
  /** Minimum number of tracks (playlists only); null = any. */
  numTracks: number | null;
  /** Playlists only: show only playlists the user has favorited. */
  favoritesOnly: boolean;
}

export const EMPTY_LIBRARY_FILTERS: LibraryFilters = {
  search: '',
  startDate: '',
  endDate: '',
  numTracks: null,
  favoritesOnly: false,
};

export interface LibraryStore {
  // Two sections (playlists, tracks), each kept in the store so switching tabs is instant and each
  // tab's count stays visible. Favorites are surfaced inline on playlists (heart), not a tab.
  playlists: LibraryPlaylist[];
  tracks: LibraryTrack[];

  error: string | null;
  activeTab: 'playlists' | 'tracks';

  // Per-section loading so the active tab shows its own spinner while the other loads in background.
  playlistsLoading: boolean;
  tracksLoading: boolean;

  // Pagination & counts (per section)
  playlistsPage: number;
  playlistsTotalPages: number;
  playlistsTotal: number;

  tracksPage: number;
  tracksTotalPages: number;
  tracksTotal: number;

  // Applied filters (per section). Held here so pagination + Refresh re-apply the same query.
  playlistsFilters: LibraryFilters;
  tracksFilters: LibraryFilters;

  setPlaylists: (playlists: LibraryPlaylist[]) => void;
  setTracks: (tracks: LibraryTrack[]) => void;

  setPlaylistsLoading: (loading: boolean) => void;
  setTracksLoading: (loading: boolean) => void;

  setError: (error: string | null) => void;
  setActiveTab: (tab: 'playlists' | 'tracks') => void;

  setPlaylistsPagination: (page: number, totalPages: number, total: number) => void;
  setTracksPagination: (page: number, totalPages: number, total: number) => void;

  setPlaylistsFilters: (filters: LibraryFilters) => void;
  setTracksFilters: (filters: LibraryFilters) => void;

  reset: () => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  playlists: [],
  tracks: [],
  error: null,
  activeTab: 'playlists',

  playlistsLoading: false,
  tracksLoading: false,

  playlistsPage: 1,
  playlistsTotalPages: 1,
  playlistsTotal: 0,

  tracksPage: 1,
  tracksTotalPages: 1,
  tracksTotal: 0,

  playlistsFilters: { ...EMPTY_LIBRARY_FILTERS },
  tracksFilters: { ...EMPTY_LIBRARY_FILTERS },

  setPlaylists: (playlists) => set({ playlists }),
  setTracks: (tracks) => set({ tracks }),

  setPlaylistsLoading: (playlistsLoading) => set({ playlistsLoading }),
  setTracksLoading: (tracksLoading) => set({ tracksLoading }),

  setError: (error) => set({ error }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setPlaylistsPagination: (playlistsPage, playlistsTotalPages, playlistsTotal) =>
    set({ playlistsPage, playlistsTotalPages, playlistsTotal }),
  setTracksPagination: (tracksPage, tracksTotalPages, tracksTotal) =>
    set({ tracksPage, tracksTotalPages, tracksTotal }),

  setPlaylistsFilters: (playlistsFilters) => set({ playlistsFilters }),
  setTracksFilters: (tracksFilters) => set({ tracksFilters }),

  reset: () => set({
    playlists: [],
    tracks: [],
    error: null,
    activeTab: 'playlists',
    playlistsLoading: false,
    tracksLoading: false,
    playlistsPage: 1,
    playlistsTotalPages: 1,
    playlistsTotal: 0,
    tracksPage: 1,
    tracksTotalPages: 1,
    tracksTotal: 0,
    playlistsFilters: { ...EMPTY_LIBRARY_FILTERS },
    tracksFilters: { ...EMPTY_LIBRARY_FILTERS },
  }),
}));
