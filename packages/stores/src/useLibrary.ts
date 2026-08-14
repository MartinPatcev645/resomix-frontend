import { create } from 'zustand'

/** Analysis-derived display metrics for an uploaded track (null until the analysis lands). */
export interface LibraryTrackAnalysis {
  top_genre: string | null;
  bpm: number | null;
  music_key: string | null;
  scale: string | null;
  camelot: string | null;
}

/**
 * What is happening to one sibling artifact, straight from `track_artifact_status`.
 *
 * `pending` queued · `processing` running now · `ready` it exists · `unavailable` it ran and
 * produced nothing · `failed` it broke · `unknown` no record (an upload from before the backend
 * tracked this).
 *
 * `unavailable` and `failed` are deliberately separate. "No close enough matches in the catalogue"
 * is a normal outcome and should not be shown as an error; "we could not analyse this" should.
 */
export type ArtifactState =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'unavailable'
  | 'failed'
  | 'unknown';

export interface LibraryTrackArtifact {
  state: ArtifactState;
  /** Display text, backend-authored. Only ever set on `failed` / `unavailable`. */
  error?: string | null;
}

export interface LibraryTrackArtifacts {
  playlist: LibraryTrackArtifact;
  analysis: LibraryTrackArtifact;
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
  /**
   * True → this track HAS a Sonic Discovery playlist, but it is beyond the plan's Library cap and
   * its uuid was withheld.
   *
   * Needed because `playlist_uuid: null` now covers two different situations — never built, and
   * built but out of reach — which want opposite messages ("we're still finding matches" vs
   * "upgrade to open this").
   */
  playlist_locked?: boolean;
  analysis_uuid?: string | null;
  analysis?: LibraryTrackAnalysis | null;
  /**
   * What the absence of one of those uuids MEANS. Optional because a cached response from before
   * this shipped will not carry it; `TrackArtifactChips` treats an absent block as `unknown`.
   */
  artifacts?: LibraryTrackArtifacts | null;
  // Upload timestamp (ISO). Shown on the row; no longer used to guess at artifact state — that
  // guess ("younger than 15 minutes ⇒ still generating") is what `artifacts` replaced.
  created_at?: string | null;
}

/**
 * A track the user thumbed up, as the Liked tab renders it.
 *
 * Deliberately a different shape from `LibraryTrack`: that one describes an UPLOAD the user owns
 * (with its two sibling artifacts and their pipeline state), whereas this is any catalogue track
 * they liked from a playlist. Merging them would give every liked row a set of artifact fields
 * that can never apply to it.
 */
export interface LikedTrack {
  /** Track uuid. */
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  label: string | null;
  genre: string | null;
  /** Seconds (Apple's full length when matched, else the in-house value). */
  duration: number | null;
  /** Apple artwork, when the track has a match; null falls back to the bundled cover. */
  artwork_url?: string | null;
  /** "preview" (Apple) or "hls" (uploads / unmatched) — the same hint the playlist screen uses. */
  playback?: string | null;
  preview_url?: string | null;
  /** ISO timestamp of the most recent time the user liked this track. Drives the ordering. */
  liked_at: string | null;
}

export interface LibraryPlaylist {
  /**
   * Stable list key. For an unlocked playlist this is its uuid; for a locked one the backend
   * sends no identifier at all, so the hook synthesises a positional key. Never route on it —
   * check `uuid` (which is null when locked) instead.
   */
  id: string;
  /**
   * The real identifier, or **null** when this playlist is beyond the plan's Library cap.
   *
   * Its absence is the gate, not a rendering hint: with no uuid the client cannot build a route,
   * call the detail endpoint or fetch the cover. Greying the row explains that; it does not cause
   * it. Anything that navigates must therefore check for null rather than trusting `isVisible`.
   */
  uuid: string | null;
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
  /**
   * False → beyond the plan's Library cap: listed, described, but not reachable.
   *
   * The row is NOT missing and NOT deleted — it still shows its name, track count, duration and
   * date, so the user can see what they have. Only the ways to reach it are withheld.
   */
  isVisible: boolean;
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

/** The Library's three sections. Also the `?tab=` value, so these strings are user-visible. */
export type LibraryTab = 'playlists' | 'tracks' | 'liked';

export interface LibraryStore {
  // Two sections (playlists, tracks), each kept in the store so switching tabs is instant and each
  // tab's count stays visible. Favorites are surfaced inline on playlists (heart), not a tab.
  playlists: LibraryPlaylist[];
  tracks: LibraryTrack[];
  liked: LikedTrack[];

  error: string | null;
  activeTab: LibraryTab;

  // Per-section loading so the active tab shows its own spinner while the other loads in background.
  playlistsLoading: boolean;
  tracksLoading: boolean;
  likedLoading: boolean;

  // Pagination & counts (per section)
  playlistsPage: number;
  playlistsTotalPages: number;
  playlistsTotal: number;
  /**
   * Every playlist the user OWNS, hidden ones included — the denominator in "5 of 18 shown".
   *
   * Distinct from `playlistsTotal`, which counts what the current filter matched. Free accounts
   * list only `library_playlists_max`; the rest still exist and work by link, so the Library has to
   * account for them rather than appear to have lost them.
   */
  playlistsLibraryTotal: number;

  tracksPage: number;
  tracksTotalPages: number;
  tracksTotal: number;

  likedPage: number;
  likedTotalPages: number;
  likedTotal: number;

  // Applied filters (per section). Held here so pagination + Refresh re-apply the same query.
  playlistsFilters: LibraryFilters;
  tracksFilters: LibraryFilters;

  setPlaylists: (playlists: LibraryPlaylist[]) => void;
  setTracks: (tracks: LibraryTrack[]) => void;
  setLiked: (liked: LikedTrack[]) => void;

  setPlaylistsLoading: (loading: boolean) => void;
  setTracksLoading: (loading: boolean) => void;
  setLikedLoading: (loading: boolean) => void;

  setError: (error: string | null) => void;
  setActiveTab: (tab: LibraryTab) => void;

  setPlaylistsPagination: (page: number, totalPages: number, total: number, libraryTotal?: number) => void;
  setTracksPagination: (page: number, totalPages: number, total: number) => void;
  setLikedPagination: (page: number, totalPages: number, total: number) => void;

  setPlaylistsFilters: (filters: LibraryFilters) => void;
  setTracksFilters: (filters: LibraryFilters) => void;

  reset: () => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  playlists: [],
  tracks: [],
  liked: [],
  error: null,
  // Uploads is the landing tab — it reflects what the user most recently did
  // (analysed a track), and it now sits first in the tab strip.
  activeTab: 'tracks',

  playlistsLoading: false,
  tracksLoading: false,
  likedLoading: false,

  playlistsPage: 1,
  playlistsTotalPages: 1,
  playlistsTotal: 0,
  playlistsLibraryTotal: 0,

  tracksPage: 1,
  tracksTotalPages: 1,
  tracksTotal: 0,

  likedPage: 1,
  likedTotalPages: 1,
  likedTotal: 0,

  playlistsFilters: { ...EMPTY_LIBRARY_FILTERS },
  tracksFilters: { ...EMPTY_LIBRARY_FILTERS },

  setPlaylists: (playlists) => set({ playlists }),
  setTracks: (tracks) => set({ tracks }),
  setLiked: (liked) => set({ liked }),

  setLikedLoading: (likedLoading) => set({ likedLoading }),
  setPlaylistsLoading: (playlistsLoading) => set({ playlistsLoading }),
  setTracksLoading: (tracksLoading) => set({ tracksLoading }),

  setError: (error) => set({ error }),
  setActiveTab: (activeTab) => set({ activeTab }),

  setPlaylistsPagination: (playlistsPage, playlistsTotalPages, playlistsTotal, playlistsLibraryTotal) =>
    set({
      playlistsPage,
      playlistsTotalPages,
      playlistsTotal,
      // Only overwrite when the caller actually supplied it, so a listing from an older server
      // (no `library_total`) leaves the previous value rather than zeroing the denominator.
      ...(playlistsLibraryTotal === undefined ? {} : { playlistsLibraryTotal }),
    }),
  setTracksPagination: (tracksPage, tracksTotalPages, tracksTotal) =>
    set({ tracksPage, tracksTotalPages, tracksTotal }),
  setLikedPagination: (likedPage, likedTotalPages, likedTotal) =>
    set({ likedPage, likedTotalPages, likedTotal }),

  setPlaylistsFilters: (playlistsFilters) => set({ playlistsFilters }),
  setTracksFilters: (tracksFilters) => set({ tracksFilters }),

  reset: () => set({
    playlists: [],
    tracks: [],
    liked: [],
    error: null,
    activeTab: 'tracks',
    playlistsLoading: false,
    tracksLoading: false,
    playlistsPage: 1,
    playlistsTotalPages: 1,
    playlistsTotal: 0,
  playlistsLibraryTotal: 0,
    tracksPage: 1,
    tracksTotalPages: 1,
    tracksTotal: 0,
    likedLoading: false,
    likedPage: 1,
    likedTotalPages: 1,
    likedTotal: 0,
    playlistsFilters: { ...EMPTY_LIBRARY_FILTERS },
    tracksFilters: { ...EMPTY_LIBRARY_FILTERS },
  }),
}));
