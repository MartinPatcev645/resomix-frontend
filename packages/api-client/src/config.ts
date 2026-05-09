export interface ApiConfig {
  BASE_URL: string;
  BASE_URL_LOCAL: string;
  MEDIA_URL: string;
  API_KEY: string;
  MAX_FILE_SIZE: number;
  ALLOWED_AUDIO_TYPES: string[];
  ENDPOINTS: {
    // beta endpoints
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
    PLAYLIST_SIMILARITY_HLS: string;
    PLAYLIST_FORK: string;
    PLAYLIST_PLAY_SESSION: string;
    WAITLIST: string;
    // SEGMENT_STATUS: string; // Commented out - segmentation polling no longer needed
    // Admin endpoints
    ADMIN_FEEDBACK_LIST: string;
    ADMIN_FEEDBACK_DELETE: string;
    ADMIN_FEEDBACK_BATCH_DELETE: string;
    ADMIN_FEEDBACK_UPDATE: string;
    ADMIN_FEEDBACK_MARK_STATUS: string;
    ADMIN_FEEDBACK_EXPORT: string;
    ADMIN_CONTACT_LIST: string;
    ADMIN_CONTACT_DELETE: string;
    ADMIN_CONTACT_BATCH_DELETE: string;
    ADMIN_CONTACT_UPDATE: string;
    ADMIN_CONTACT_MARK_STATUS: string;
    ADMIN_CONTACT_EXPORT: string;
    ADMIN_WAITLIST_LIST: string;
    ADMIN_WAITLIST_DELETE: string;
    ADMIN_WAITLIST_BATCH_DELETE: string;
    ADMIN_WAITLIST_UPDATE_STATUS: string;
    ADMIN_WAITLIST_EXPORT: string;
    ADMIN_PLAYLIST_LIST: string;
    ADMIN_PLAYLIST_DELETE: string;
    ADMIN_PLAYLIST_BATCH_DELETE: string;
    ADMIN_PLAYLIST_EXPORT: string;
    ADMIN_PLAYLIST_DETAILS: string;
    ADMIN_PLAYLIST_VISIBILITY: string;
    ADMIN_PLAYLIST_BATCH_VISIBILITY: string;
    ADMIN_OPERATION_TYPES: string;
    ADMIN_OPERATION_LIMITS: string;
    ADMIN_OPERATION_LIMIT_DETAIL: string;
    ADMIN_SPOTIFY_APPS: string;
    ADMIN_SPOTIFY_APP_USERS: string;
    ADMIN_USER_SEARCH: string;
    ADMIN_PARTNER_LIST: string;
    ADMIN_PARTNER_CREATE: string;
    ADMIN_PARTNER_API_KEY_ISSUE: string;
    ADMIN_PARTNER_API_KEY_LIST: string;
    ADMIN_PARTNER_API_KEY_REVOKE: string;
    ADMIN_PARTNER_API_KEY_ROTATE: string;
    // Telemetry
    TELEMETRY_SYNC: string;
    // Cart & Checkout
    CART_GET: string;
    CART_ADD: string;
    CART_REMOVE: string;
    CART_REMOVE_PLAYLIST: string;
    CART_PROMO: string;
    CART_CLEAR: string;
    CHECKOUT_CREATE_SESSION: string;
    // unused beta endpoints
    // SPOTIFY_TRANSFER: string;
    // TIDAL_AUTH_TOKEN: string;
    // TIDAL_TRANSFER: string;
    // APPLE_TRANSFER: string;
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
  MEDIA_URL: getEnv("VITE_SERVER_MEDIA", "https://media.resomix.com"),
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
    "audio/aiff",
    "audio/x-aiff",
  ],
  ENDPOINTS: {
    // beta endpoints
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
    PLAYLIST_SIMILARITY_HLS: "/playlists/similarity-hls/",
    PLAYLIST_FORK: "/playlists/fork/",
    PLAYLIST_PLAY_SESSION: "/playlists/{id}/play-session",
    WAITLIST: "/waitlist/",
    // Telemetry
    TELEMETRY_SYNC: "/telemetry/sync",
    // Cart & Checkout
    CART_GET: "/cart",
    CART_ADD: "/cart/add",
    CART_REMOVE: "/cart/remove/",
    CART_REMOVE_PLAYLIST: "/cart/remove-playlist/",
    CART_PROMO: "/cart/promo",
    CART_CLEAR: "/cart/clear",
    CHECKOUT_CREATE_SESSION: "/checkout/create-session",
    // SEGMENT_STATUS: "/segment_status/", // Commented out - segmentation polling no longer needed
    // Admin endpoints
    ADMIN_FEEDBACK_LIST: "/admin/feedback/",
    ADMIN_FEEDBACK_DELETE: "/admin/feedback/delete/",
    ADMIN_FEEDBACK_BATCH_DELETE: "/admin/feedback/batch-delete",
    ADMIN_FEEDBACK_UPDATE: "/admin/feedback/update/",
    ADMIN_FEEDBACK_MARK_STATUS: "/admin/feedback/mark-status/",
    ADMIN_FEEDBACK_EXPORT: "/admin/feedback/export",
    ADMIN_CONTACT_LIST: "/admin/contact/",
    ADMIN_CONTACT_DELETE: "/admin/contact/delete/",
    ADMIN_CONTACT_BATCH_DELETE: "/admin/contact/batch-delete",
    ADMIN_CONTACT_UPDATE: "/admin/contact/update/",
    ADMIN_CONTACT_MARK_STATUS: "/admin/contact/mark-status/",
    ADMIN_CONTACT_EXPORT: "/admin/contact/export",
    ADMIN_WAITLIST_LIST: "/admin/waitlist/",
    ADMIN_WAITLIST_DELETE: "/admin/waitlist/delete/",
    ADMIN_WAITLIST_BATCH_DELETE: "/admin/waitlist/batch-delete",
    ADMIN_WAITLIST_UPDATE_STATUS: "/admin/waitlist/update-status/",
    ADMIN_WAITLIST_EXPORT: "/admin/waitlist/export",
    ADMIN_PLAYLIST_LIST: "/admin/playlist/",
    ADMIN_PLAYLIST_DELETE: "/admin/playlist/delete/",
    ADMIN_PLAYLIST_BATCH_DELETE: "/admin/playlist/batch-delete",
    ADMIN_PLAYLIST_EXPORT: "/admin/playlist/export",
    ADMIN_PLAYLIST_DETAILS: "/admin/playlist/",
    ADMIN_PLAYLIST_VISIBILITY: "/admin/playlist/visibility/",
    ADMIN_PLAYLIST_BATCH_VISIBILITY: "/admin/playlist/batch-visibility",
    ADMIN_OPERATION_TYPES: "/admin/operation-limits/operation-types",
    ADMIN_OPERATION_LIMITS: "/admin/operation-limits/",
    ADMIN_OPERATION_LIMIT_DETAIL: "/admin/operation-limits/",
    ADMIN_SPOTIFY_APPS: "/admin/spotify-apps/",
    ADMIN_SPOTIFY_APP_USERS: "/admin/spotify-apps/users",
    ADMIN_USER_SEARCH: "/users/search",
    // Partner Management
    ADMIN_PARTNER_LIST: "/admin/partners/",
    ADMIN_PARTNER_CREATE: "/admin/partners/",
    ADMIN_PARTNER_API_KEY_ISSUE: "/admin/partners/api-keys/issue",
    ADMIN_PARTNER_API_KEY_LIST: "/admin/partners/api-keys/",
    ADMIN_PARTNER_API_KEY_REVOKE: "/admin/partners/api-keys/revoke",
    ADMIN_PARTNER_API_KEY_ROTATE: "/admin/partners/api-keys/rotate",
    // Unused beta endpoints
    // SPOTIFY_TRANSFER: "/spotify/transfer-playlist/",
    // TIDAL_AUTH_TOKEN: "/tidal/auth/token",
    // TIDAL_TRANSFER: "/tidal/transfer-playlist/",
  },
};


export const APPLE_CONFIG = {
  MUSIC_KIT_SRC: 'https://js-cdn.music.apple.com/musickit/v1/musickit.js',
  GUARD_PREFIX: 'apple_auth_guard_',
  REDIRECT_URI: `${getEnv("VITE_BASE_BETA_URL", "https://beta.resomix.com")}/apple-redirect`,
  APPLE_AUTH_TOKEN: '/apple/auth/token',
  APPLE_TRANSFER: "/apple/transfer-playlist/",
  APP_NAME:  "ResomiX",
  APP_BUILD: "1.0.0",
};


// Spotify configuration
export const SPOTIFY_CONFIG = {
  CLIENT_ID: getEnv("VITE_SPOTIFY_CLIENT_ID") || '9df225a14080472c8c4ea5fc85b3eb6b',
  // REDIRECT_URI: `${window.location.origin}/test`, // Callback URL
  // REDIRECT_URI: 'https://beta-old.resomix.com/test',
  REDIRECT_URI: `${getEnv("VITE_BASE_BETA_URL", "https://beta.resomix.com")}/spotify-redirect`,
  SCOPES: 'playlist-modify-public playlist-modify-private',
  AUTH_URL: 'https://accounts.spotify.com/authorize',
  TOKEN_URL: 'https://accounts.spotify.com/api/token',
  SPOTIFY_TRANSFER: "/spotify/transfer-playlist/",
};

/*
// Tidal configuration
export const TIDAL_CONFIG = {
  CLIENT_ID: getEnv("VITE_TIDAL_CLIENT_ID") || 'AxOkLsNxSDQ8InZU',
  // REDIRECT_URI: 'https://beta.resomix.com/test',
  REDIRECT_URI: 'https://stack.resomix.com/tidal-redirect',
  SCOPE: 'user.read playlists.read playlists.write',
  AUTH_URL: 'https://login.tidal.com/authorize',
  AUTH_AUTHORIZE: 'https://beta-old.resomix.com/tidal/auth/authorize',
};
*/

export const TIDAL_CONFIG = {
  CLIENT_ID: getEnv("VITE_TIDAL_CLIENT_ID") || 'ds7LnGkxqwFXUE6s',
  REDIRECT_URI: `${getEnv("VITE_BASE_BETA_URL", "https://beta.resomix.com")}/tidal-redirect`,
  SCOPE: 'user.read playlists.read playlists.write',
  AUTH_URL: 'https://login.tidal.com/authorize',
  TIDAL_AUTH_TOKEN: '/tidal/auth/token',
  TIDAL_TRANSFER: "/tidal/transfer-playlist/",
};
