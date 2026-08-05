export interface ApiConfig {
  BASE_URL: string;
  BASE_URL_LOCAL: string;
  MEDIA_URL: string;
  MAX_FILE_SIZE: number;
  ALLOWED_AUDIO_TYPES: string[];
  ENDPOINTS: {
    // Auth & User endpoints
    AUTH_LOGIN: string;
    AUTH_GOOGLE: string;
    AUTH_LOGOUT: string;
    AUTH_LOGOUT_ALL: string;
    AUTH_REGISTER: string;
    AUTH_REFRESH: string;
    AUTH_VERIFY_2FA: string;
    AUTH_VERIFY_EMAIL: string;
    AUTH_RESEND_VERIFICATION: string;
    AUTH_PASSWORD_RESET: string;
    AUTH_PASSWORD_RESET_CONFIRM: string;
    USER_ME: string;
    USER_CHANGE_PASSWORD: string;
    USER_SESSIONS: string;
    USER_ENABLE_2FA: string;
    USER_DISABLE_2FA: string;
    USER_DELETE: string;

    // Entitlements (frontend plans/guest enforcement)
    ENTITLEMENTS_ME: string;
    BILLING_PLANS: string;
    BILLING_SUBSCRIPTION: string;
    BILLING_INVOICES: string;
    BILLING_CHECKOUT: string;
    BILLING_PORTAL: string;

    // Beta endpoints
    SIMILARITY: string;
    SELECTION_SIMILARITY: string;
    ANALYSIS: string;
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
    PLAYLIST_EXPORT: string;
    PLAYLISTS_GET_ALL: string;
    PLAYLIST_DELETE: string;
    PLAYLIST_COVER: string;
    WAITLIST: string;
    WAITLIST_STATUS: string;
    SEGMENT_STATUS: string;
    MY_TRACKS: string;

    // Playlist Engagement
    PLAYLIST_FAVORITE_ADD: string;
    PLAYLIST_FAVORITE_REMOVE: string;
    PLAYLIST_FOLLOW: string;
    PLAYLIST_UNFOLLOW: string;

    // Ratings
    RATING_TRACKS_DETAIL: string;
    RATING_PLAYLISTS_DETAIL: string;
    RATING_PLAYLIST_STATS: string;
    RATING_TRACK_STATS: string;
    
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
    ADMIN_PLANS: string;
    ADMIN_FEATURES: string;
    ADMIN_ENTITLEMENT_METRICS: string;
    ADMIN_SPOTIFY_APPS: string;
    ADMIN_SPOTIFY_APP_USERS: string;
    ADMIN_USER_SEARCH: string;
    ADMIN_PARTNER_LIST: string;
    ADMIN_PARTNER_CREATE: string;
    ADMIN_PARTNER_DETAIL: string;
    ADMIN_PARTNER_API_KEY_ISSUE: string;
    ADMIN_PARTNER_API_KEY_LIST: string;
    ADMIN_PARTNER_API_KEY_REVOKE: string;
    ADMIN_PARTNER_API_KEY_ROTATE: string;
    ADMIN_PARTNER_SFTP_PROVISION: string;
    ADMIN_PARTNER_WEBHOOKS: string;
    ADMIN_WEBHOOK_LOGS_FAILED: string;
    ADMIN_WEBHOOK_LOGS_RETRY: string;
    ADMIN_SYSTEM_LOGS: string;
    ADMIN_SYSTEM_LOGS_STATS: string;
    ADMIN_SYSTEM_LOGS_OVERVIEW: string;
    ADMIN_SYSTEM_LOGS_FACETS: string;
    ADMIN_OPERATION_LOGS: string;
    ADMIN_PARTNER_STRIPE_CHECKOUT: string;
    ADMIN_AUTH_LOGIN: string;
    ADMIN_AUTH_VERIFY_2FA: string;
    ADMIN_AUTH_REFRESH: string;
    ADMIN_AUTH_LOGOUT: string;
    ADMIN_AUTH_ME: string;
    ADMIN_PROMO_CREATE: string;
    ADMIN_SIMILARITY_REBUILD: string;
    PARTNER_ME: string;
    // User management
    ADMIN_USER_DETAIL: string;
    // Role management
    ADMIN_ROLE_DETAIL: string;
    ADMIN_ROLE_PERMISSIONS_UPDATE: string;
    // Feedback detail
    ADMIN_FEEDBACK_DETAIL: string;
    ADMIN_FEEDBACK_STATS: string;
    // Contact detail
    ADMIN_CONTACT_DETAIL: string;

    // Telemetry
    TELEMETRY_SYNC: string;

    // Cart & Checkout
    CART_GET: string;
    CART_ADD: string;
    CART_REMOVE: string;
    CART_REMOVE_PLAYLIST: string;
    CART_PROMO: string;
    CART_CLEAR: string;
    CHECKOUT_INIT: string;
    CHECKOUT_CREATE_SESSION: string;

    // Legacy Ingestion Pipelines (deprecated — use admin ingestion endpoints instead)
    INGEST_MONTHLY_TRACK: string;
    INGEST_MONTHLY_EMBEDDINGS: string;
    INGEST_OPEN_TRACK: string;
    INGEST_OPEN_EMBEDDINGS: string;

    // Metadata
    METADATA_EXTRACT: string;

    // System
    HEALTH: string;
    ROOT: string;

    // Spotify Pre-flight
    SPOTIFY_CLIENT_ID: string;

    // B2B Partner endpoints
    PARTNER_PLAYBACK_TOKEN: string;
    PARTNER_DELETION_LOG: string;

    // Admin — Processing Jobs
    ADMIN_PROCESSING_JOBS_EMBEDDINGS: string;
    ADMIN_PROCESSING_JOBS: string;
    ADMIN_PROCESSING_JOBS_PAUSE: string;
    ADMIN_PROCESSING_JOBS_RESUME: string;
    ADMIN_PROCESSING_JOBS_STAGE: string;

    // Admin — Ingestion Control
    ADMIN_INGESTION_LOGS: string;
    ADMIN_INGESTION_TRIGGER: string;
    ADMIN_INGESTION_LOG_STATUS: string;

    // Admin — Track Control
    ADMIN_TRACKS: string;
    ADMIN_TRACKS_STOP_BATCH: string;

    // Admin — Webhook delete
    ADMIN_PARTNER_WEBHOOK_DETAIL: string;
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
    // Auth & User endpoints
    AUTH_LOGIN: "/api/v1/auth/login",
    AUTH_GOOGLE: "/api/v1/auth/google",
    AUTH_LOGOUT: "/api/v1/auth/logout",
    AUTH_LOGOUT_ALL: "/api/v1/auth/logout-all",
    AUTH_REGISTER: "/api/v1/auth/register",
    AUTH_REFRESH: "/api/v1/auth/refresh",
    AUTH_VERIFY_2FA: "/api/v1/auth/verify-2fa",
    AUTH_VERIFY_EMAIL: "/api/v1/auth/verify-email",
    AUTH_RESEND_VERIFICATION: "/api/v1/auth/resend-verification",
    AUTH_PASSWORD_RESET: "/api/v1/auth/password-reset",
    AUTH_PASSWORD_RESET_CONFIRM: "/api/v1/auth/password-reset-confirm",
    USER_ME: "/api/v1/users/me",
    USER_CHANGE_PASSWORD: "/api/v1/users/me/change-password",
    USER_SESSIONS: "/api/v1/users/me/sessions",
    USER_ENABLE_2FA: "/api/v1/users/me/enable-2fa",
    USER_DISABLE_2FA: "/api/v1/users/me/disable-2fa",
    USER_DELETE: "/api/v1/users/me",
    // Entitlements (frontend plans/guest enforcement)
    ENTITLEMENTS_ME: "/api/v1/entitlements/me",
    BILLING_PLANS: "/api/v1/billing/plans",
    BILLING_SUBSCRIPTION: "/api/v1/billing/subscription",
    BILLING_INVOICES: "/api/v1/billing/invoices",
    BILLING_CHECKOUT: "/api/v1/billing/checkout",
    BILLING_PORTAL: "/api/v1/billing/portal",
    // Beta endpoints
    SIMILARITY: "/api/v1/similarity/upload",
    SELECTION_SIMILARITY: "/api/v1/similarity/search",
    // Analysis-as-an-artifact (return-visit retrieval via Alwyzon; base + {analysis_uuid})
    ANALYSIS: "/api/v1/analysis",
    SEARCH: "/api/v1/search_tracks/",
    FEEDBACK: "/api/v1/feedback/",
    CONTACT: "/api/v1/contact/",
    AUDIO_PREVIEW: "/api/v1/preview/get_preview/",
    PLAYLIST_RENAME: "/api/v1/playlists/rename/",
    PLAYLIST_VISIBILITY: "/api/v1/playlists/visibility/",
    PLAYLIST_SIMILARITY: "/api/v1/playlists/similarity/",
    TRACK_RATING: "/api/v1/ratings/tracks/",
    PLAYLIST_RATING: "/api/v1/ratings/playlists/",
    PLAYLIST_SIMILARITY_HLS: "/api/v1/playlists/similarity-hls/",
    PLAYLIST_FORK: "/api/v1/playlists/fork/",
    PLAYLIST_PLAY_SESSION: "/api/v1/playlists/{id}/play-session",
    // Server-built export. The file is assembled backend-side so the plan's daily allowance and
    // track cap apply to the bytes; the browser only downloads what comes back.
    PLAYLIST_EXPORT: "/api/v1/playlists/{id}/export",
    PLAYLISTS_GET_ALL: "/api/v1/playlists/get-all-playlists/",
    PLAYLIST_DELETE: "/api/v1/playlists",
    // Owner-only custom cover upload — full path is `${PLAYLIST_COVER}/${uuid}/cover`.
    PLAYLIST_COVER: "/api/v1/playlists",
    WAITLIST: "/api/v1/waitlist/",
    WAITLIST_STATUS: "/api/v1/waitlist/status",
    SEGMENT_STATUS: "/api/v1/similarity/segment-status/",
    MY_TRACKS: "/api/v1/tracks/my-tracks",
    // Playlist Engagement
    PLAYLIST_FAVORITE_ADD: "/api/v1/playlist/add-favorite/",
    PLAYLIST_FAVORITE_REMOVE: "/api/v1/playlist/remove-favorite/",
    PLAYLIST_FOLLOW: "/api/v1/playlist/follow/",
    PLAYLIST_UNFOLLOW: "/api/v1/playlist/unfollow/",
    // Ratings Detail
    RATING_TRACKS_DETAIL: "/api/v1/ratings/tracks/",
    RATING_PLAYLISTS_DETAIL: "/api/v1/ratings/playlists/",
    RATING_PLAYLIST_STATS: "/api/v1/ratings/playlists/",
    RATING_TRACK_STATS: "/api/v1/ratings/tracks/",
    // Telemetry
    TELEMETRY_SYNC: "/api/v1/telemetry/sync",
    // Cart & Checkout
    CART_GET: "/api/v1/cart",
    CART_ADD: "/api/v1/cart/add",
    CART_REMOVE: "/api/v1/cart/remove/",
    CART_REMOVE_PLAYLIST: "/api/v1/cart/remove-playlist/",
    CART_PROMO: "/api/v1/cart/promo",
    CART_CLEAR: "/api/v1/cart/clear",
    CHECKOUT_INIT: "/api/v1/checkout/init",
    CHECKOUT_CREATE_SESSION: "/api/v1/checkout/create-session",
 
    // Admin endpoints
    ADMIN_FEEDBACK_LIST: "/api/v1/admin/feedback/",
    ADMIN_FEEDBACK_DETAIL: "/api/v1/admin/feedback/",        // GET|PATCH|DELETE /{id}
    ADMIN_FEEDBACK_STATS: "/api/v1/admin/feedback/stats",
    ADMIN_FEEDBACK_DELETE: "/api/v1/admin/feedback/",        // DELETE /{id}
    ADMIN_FEEDBACK_BATCH_DELETE: "/api/v1/admin/feedback/batch-delete",
    ADMIN_FEEDBACK_UPDATE: "/api/v1/admin/feedback/",        // PATCH /{id}
    ADMIN_FEEDBACK_MARK_STATUS: "/api/v1/admin/feedback/",   // PATCH /{id}/status
    ADMIN_FEEDBACK_EXPORT: "/api/v1/admin/feedback/export",
    ADMIN_CONTACT_LIST: "/api/v1/admin/contact/",
    ADMIN_CONTACT_DETAIL: "/api/v1/admin/contact/",          // GET|DELETE /{id}
    ADMIN_CONTACT_DELETE: "/api/v1/admin/contact/",          // DELETE /{id}
    ADMIN_CONTACT_BATCH_DELETE: "/api/v1/admin/contact/batch-delete",
    ADMIN_CONTACT_UPDATE: "/api/v1/admin/contact/",          // (reserved for future PATCH)
    ADMIN_CONTACT_MARK_STATUS: "/api/v1/admin/contact/mark-status/",
    ADMIN_CONTACT_EXPORT: "/api/v1/admin/contact/export",
    ADMIN_WAITLIST_LIST: "/api/v1/admin/waitlist/",
    ADMIN_WAITLIST_DELETE: "/api/v1/admin/waitlist/",        // DELETE /{id}
    ADMIN_WAITLIST_BATCH_DELETE: "/api/v1/admin/waitlist/batch-delete",
    ADMIN_WAITLIST_UPDATE_STATUS: "/api/v1/admin/waitlist/update-status/",
    ADMIN_WAITLIST_EXPORT: "/api/v1/admin/waitlist/export",
    ADMIN_PLAYLIST_LIST: "/api/v1/admin/playlist/",
    ADMIN_PLAYLIST_DELETE: "/api/v1/admin/playlist/",        // DELETE /{id}
    ADMIN_PLAYLIST_BATCH_DELETE: "/api/v1/admin/playlist/batch-delete",
    ADMIN_PLAYLIST_EXPORT: "/api/v1/admin/playlist/export",
    ADMIN_PLAYLIST_DETAILS: "/api/v1/admin/playlist/",
    ADMIN_PLAYLIST_VISIBILITY: "/api/v1/admin/playlist/",    // PATCH /{id}/visibility
    ADMIN_PLAYLIST_BATCH_VISIBILITY: "/api/v1/admin/playlist/batch-visibility",
    ADMIN_OPERATION_TYPES: "/api/v1/admin/operation-limits/operation-types",
    ADMIN_OPERATION_LIMITS: "/api/v1/admin/operation-limits/",
    ADMIN_OPERATION_LIMIT_DETAIL: "/api/v1/admin/operation-limits/",
    ADMIN_PLANS: "/api/v1/admin/plans",                       // GET list | GET /{code} | PATCH /{code} | PUT /{code}/entitlements/{feature_key}
    ADMIN_FEATURES: "/api/v1/admin/features",                 // GET feature catalog
    ADMIN_ENTITLEMENT_METRICS: "/api/v1/admin/entitlements/metrics",  // GET gate/cache metrics
    ADMIN_SPOTIFY_APPS: "/api/v1/admin/spotify-apps/",
    ADMIN_SPOTIFY_APP_USERS: "/api/v1/admin/spotify-apps/users",
    ADMIN_USER_SEARCH: "/api/v1/users/search",
    // User management
    ADMIN_USER_DETAIL: "/api/v1/admin/users/",              // GET|PATCH|POST /{uuid}/*
    // Role management
    ADMIN_ROLE_DETAIL: "/api/v1/admin/roles/",              // GET /{role_name}
    ADMIN_ROLE_PERMISSIONS_UPDATE: "/api/v1/admin/roles/",  // PUT /{role_name}/permissions
    // Partner Management
    ADMIN_PARTNER_LIST: "/api/v1/admin/partners/",
    ADMIN_PARTNER_CREATE: "/api/v1/admin/partners/",
    ADMIN_PARTNER_DETAIL: "/api/v1/admin/partners/",         // GET|PATCH|DELETE /{id}
    ADMIN_PARTNER_API_KEY_ISSUE: "/api/v1/admin/partners/api-keys/issue",
    ADMIN_PARTNER_API_KEY_LIST: "/api/v1/admin/partners/api-keys/",
    ADMIN_PARTNER_API_KEY_REVOKE: "/api/v1/admin/partners/api-keys/revoke",
    ADMIN_PARTNER_API_KEY_ROTATE: "/api/v1/admin/partners/api-keys/rotate",
    ADMIN_PARTNER_SFTP_PROVISION: "/api/v1/admin/partners/sftp/provision",
    ADMIN_PARTNER_WEBHOOKS: "/api/v1/admin/partners/webhooks",
    ADMIN_WEBHOOK_LOGS_FAILED: "/api/v1/admin/partners/webhooks/logs/failed",
    ADMIN_WEBHOOK_LOGS_RETRY: "/api/v1/admin/partners/webhooks/logs/",
    ADMIN_SYSTEM_LOGS: "/api/v1/admin/logs",
    ADMIN_SYSTEM_LOGS_STATS: "/api/v1/admin/logs/stats",
    ADMIN_SYSTEM_LOGS_OVERVIEW: "/api/v1/admin/logs/overview",
    ADMIN_SYSTEM_LOGS_FACETS: "/api/v1/admin/logs/facets",
    ADMIN_OPERATION_LOGS: "/api/v1/admin/operation-logs",
    ADMIN_PARTNER_STRIPE_CHECKOUT: "/api/v1/admin/partners/",
    ADMIN_AUTH_LOGIN: "/api/v1/admin/auth/login",
    ADMIN_AUTH_VERIFY_2FA: "/api/v1/admin/auth/verify-2fa",
    ADMIN_AUTH_REFRESH: "/api/v1/admin/auth/refresh",
    ADMIN_AUTH_LOGOUT: "/api/v1/admin/auth/logout",
    ADMIN_AUTH_ME: "/api/v1/admin/auth/me",
    ADMIN_PROMO_CREATE: "/api/v1/admin/promo/create",
    ADMIN_SIMILARITY_REBUILD: "/api/v1/admin/similarity/rebuild-index",
    PARTNER_ME: "/api/v1/partner/me",
    // Legacy Ingestion Pipelines (deprecated — prefer /api/v1/admin/ingestion/*)
    INGEST_MONTHLY_TRACK: "/api/v1/ingest/monthly/track",
    INGEST_MONTHLY_EMBEDDINGS: "/api/v1/ingest/monthly/update_embeddings",
    INGEST_OPEN_TRACK: "/api/v1/ingest/open/track",
    INGEST_OPEN_EMBEDDINGS: "/api/v1/ingest/open/update_embeddings",
    // Metadata
    METADATA_EXTRACT: "/api/v1/metadata/track",
    // System — versioned paths
    HEALTH: "/api/v1/health",
    ROOT: "/api/v1/",
    // Spotify Pre-flight
    SPOTIFY_CLIENT_ID: "/api/v1/spotify/app-client-id",
    // B2B Partner endpoints
    PARTNER_PLAYBACK_TOKEN: "/api/v1/partner/playback-token",
    PARTNER_DELETION_LOG: "/api/v1/partner/deletion-log",
    // Admin — Processing Jobs
    ADMIN_PROCESSING_JOBS_EMBEDDINGS: "/api/v1/admin/processing/jobs/embeddings",
    ADMIN_PROCESSING_JOBS: "/api/v1/admin/processing/jobs",
    ADMIN_PROCESSING_JOBS_PAUSE: "/api/v1/admin/processing/jobs/{id}/pause",
    ADMIN_PROCESSING_JOBS_RESUME: "/api/v1/admin/processing/jobs/{id}/resume",
    ADMIN_PROCESSING_JOBS_STAGE: "/api/v1/admin/processing/jobs",
    // Admin — Ingestion Control
    ADMIN_INGESTION_LOGS: "/api/v1/admin/ingestion/logs",
    ADMIN_INGESTION_TRIGGER: "/api/v1/admin/ingestion/trigger",
    ADMIN_INGESTION_LOG_STATUS: "/api/v1/admin/ingestion/logs",
    // Admin — Track Control
    ADMIN_TRACKS: "/api/v1/admin/tracks",
    ADMIN_TRACKS_STOP_BATCH: "/api/v1/admin/tracks/stop-batch",
    // Admin — Webhook CRUD (detail/delete by ID)
    ADMIN_PARTNER_WEBHOOK_DETAIL: "/api/v1/admin/partners/webhooks",
  },
};


export const APPLE_CONFIG = {
  MUSIC_KIT_SRC: 'https://js-cdn.music.apple.com/musickit/v1/musickit.js',
  GUARD_PREFIX: 'apple_auth_guard_',
  REDIRECT_URI: `${getEnv("VITE_BASE_BETA_URL", "https://beta.resomix.com")}/apple-redirect`,
  APPLE_AUTH_TOKEN: '/api/v1/apple-music/developer-token/',
  APPLE_TRANSFER: "/api/v1/apple-music/transfer-playlist/",
  APPLE_CONNECTION: "/api/v1/apple-music/connection/",
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
  SPOTIFY_TRANSFER: "/api/v1/spotify/transfer-playlist/",
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
  TIDAL_AUTH_TOKEN: '/api/v1/tidal/auth/token',
  TIDAL_TRANSFER: "/api/v1/tidal/transfer-playlist/",
};
