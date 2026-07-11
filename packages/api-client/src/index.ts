export { API_CONFIG, APPLE_CONFIG, TIDAL_CONFIG, SPOTIFY_CONFIG } from "./config";
export type { ApiConfig } from "./config";
export * from "./similarity";
export * from "./analysis";
export * from "./search";
export * from "./feedback";
export * from "./audio";
export * from "./playlists";
export * from "./peaks";
export * from "./waitlist";
export * from "./telemetry";
export * from "./cart";
export * from "./ratings";
export * from "./metadata";
export * from "./tracks";
export * from "./system";
export * from "./entitlements";
export { initDeviceHash, getDeviceHash } from "./deviceId";
export * from "./partner";
export * from "./playbackToken";
export * from "./admin/feedback";
export * from "./admin/contact";
export * from "./admin/waitlist";
export * from "./admin/playlist";
export * from "./admin/operationLimits";
export * from "./admin/plans";
export * from "./admin/spotifyApps";
export * from "./admin/users";
export * from "./admin/partners";
export * from "./admin/logs";
export * from "./admin/auth";
export * from "./admin/similarity";
export * from "./admin/promo";
export * from "./admin/processing";
export * from "./admin/ingestion";
export * from "./admin/tracks";
export * from "./ingest"; // legacy — deprecated, kept for backwards compat
export * from "./types/partner";
export * from "./types/api";
export { default as apiAxiosInstance, generateIdempotencyKey } from "./utils";

// Auth exports
export { default as authClient } from "./authClient";
export * from "./auth";
export * from "./types/auth";
export * from "./spotify";

