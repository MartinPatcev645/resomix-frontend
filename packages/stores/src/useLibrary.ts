import { create } from 'zustand'

export interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  year: number;
  label: string;
  duration: string;
  playlist_uuid?: string | null;
  has_analysis?: boolean;
  has_similarity?: boolean;
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
  playlists: LibraryPlaylist[];
  tracks: LibraryTrack[];
  loading: boolean;
  error: string | null;
  activeTab: 'playlists' | 'favorites' | 'tracks';
  
  // Pagination & counts
  playlistsPage: number;
  playlistsTotalPages: number;
  playlistsTotal: number;
  
  tracksPage: number;
  tracksTotalPages: number;
  tracksTotal: number;

  setPlaylists: (playlists: LibraryPlaylist[]) => void;
  setTracks: (tracks: LibraryTrack[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTab: (tab: 'playlists' | 'favorites' | 'tracks') => void;
  
  setPlaylistsPagination: (page: number, totalPages: number, total: number) => void;
  setTracksPagination: (page: number, totalPages: number, total: number) => void;
  
  reset: () => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  playlists: [],
  tracks: [],
  loading: false,
  error: null,
  activeTab: 'playlists',
  
  playlistsPage: 1,
  playlistsTotalPages: 1,
  playlistsTotal: 0,
  
  tracksPage: 1,
  tracksTotalPages: 1,
  tracksTotal: 0,

  setPlaylists: (playlists) => set({ playlists }),
  setTracks: (tracks) => set({ tracks }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setActiveTab: (activeTab) => set({ activeTab }),
  
  setPlaylistsPagination: (playlistsPage, playlistsTotalPages, playlistsTotal) => 
    set({ playlistsPage, playlistsTotalPages, playlistsTotal }),
  setTracksPagination: (tracksPage, tracksTotalPages, tracksTotal) => 
    set({ tracksPage, tracksTotalPages, tracksTotal }),
    
  reset: () => set({
    playlists: [],
    tracks: [],
    loading: false,
    error: null,
    activeTab: 'playlists',
    playlistsPage: 1,
    playlistsTotalPages: 1,
    playlistsTotal: 0,
    tracksPage: 1,
    tracksTotalPages: 1,
    tracksTotal: 0,
  }),
}));
