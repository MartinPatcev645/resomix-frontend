export { API_CONFIG, APPLE_CONFIG, TIDAL_CONFIG, SPOTIFY_CONFIG } from "./config";
export type { ApiConfig } from "./config";
export * from "./similarity";
export * from "./search";
export * from "./feedback";
export * from "./audio";
export * from "./playlists";
export * from "./peaks";
export * from "./waitlist";
export * from "./telemetry";
export * from "./admin/feedback";
export * from "./admin/contact";
export * from "./admin/waitlist";
export * from "./admin/playlist";
export * from "./admin/operationLimits";
export * from "./admin/spotifyApps";
export * from "./admin/users";
export { default as apiAxiosInstance } from "./utils";

// Auth exports
export { default as authClient } from "./authClient";
export * from "./auth";
export * from "./types/auth";
export * from "./spotify";
