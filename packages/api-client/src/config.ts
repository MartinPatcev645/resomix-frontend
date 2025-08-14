export interface ApiConfig {
  BASE_URL: string;
  BASE_URL_LOCAL: string;
  API_KEY: string;
  MAX_FILE_SIZE: number;
  ALLOWED_AUDIO_TYPES: string[];
  ENDPOINTS: {
    SIMILARITY: string;
    SELECTION_SIMILARITY: string;
    SEARCH: string;
    FEEDBACK: string;
    CONTACT: string;
    AUDIO_PREVIEW: string;
    PLAYLIST_RENAME: string;
    PLAYLIST_VISIBILITY: string;
    PLAYLIST_SIMILARITY: string;
    TRACK_RATING: string;
    PLAYLIST_RATING: string;
    SPOTIFY_TRANSFER: string;
    TIDAL_AUTH_TOKEN: string;
    TIDAL_TRANSFER: string;
  };
}

export interface TidalConfig {
  REDIRECT_URI: string;
}

// Helper to safely read env vars (works in Vite and Node)
const getEnv = (key: string, fallback = ""): string => {
  if (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env[key] !== undefined) {
    return (import.meta as any).env[key] as string;
  }
  if (typeof process !== "undefined" && process.env && process.env[key] !== undefined) {
    return process.env[key] as string;
  }
  return fallback;
};

export const API_CONFIG: ApiConfig = {
  BASE_URL: getEnv("VITE_SERVER_BACKEND", "https://bserver.resomix.com"),
  BASE_URL_LOCAL: getEnv("VITE_BASE_BETA_URL", "https://beta.resomix.com"), // used by desktop apps for direct calls
  API_KEY: getEnv("VITE_API_KEY", "bearer-resomix-api-V2BjX95N3MwxtCNQ83jWQmkqTtwJzJ"),
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100 MB
  ALLOWED_AUDIO_TYPES: [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/vnd.wave",
    "audio/ogg",
    "audio/aac",
    "audio/flac",
    "audio/x-flac",
  ],
  ENDPOINTS: {
    SIMILARITY: "/get_similarity/",
    SELECTION_SIMILARITY: "/get_selection_similarity/",
    SEARCH: "/search_tracks/",
    FEEDBACK: "/feedback/",
    CONTACT: "/contact/",
    AUDIO_PREVIEW: "/preview/get_preview/",
    PLAYLIST_RENAME: "/playlists/rename/",
    PLAYLIST_VISIBILITY: "/playlists/visibility/",
    PLAYLIST_SIMILARITY: "/playlists/similarity/",
    TRACK_RATING: "/ratings/tracks/",
    PLAYLIST_RATING: "/ratings/playlists/",
    SPOTIFY_TRANSFER: "/spotify/transfer-playlist/",
    TIDAL_AUTH_TOKEN: "/tidal/auth/token", // no trailing slash
    TIDAL_TRANSFER: "/tidal/transfer-playlist/",
  },
};

export const TIDAL_CONFIG: TidalConfig = {
  REDIRECT_URI: getEnv("VITE_TIDAL_REDIRECT_URI", ""),
};
