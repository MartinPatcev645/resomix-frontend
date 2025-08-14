export interface AppConfig {
  baseLandingUrl: string
  baseBetaUrl: string
  facebookUrl: string
  instagramUrl: string
  twitterUrl: string
  soundcloudUrl: string
  serverBackend: string
  serverMedia: string
  mode: string
}

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env

export const CONFIG: AppConfig = {
  baseLandingUrl: env.VITE_BASE_LANDING_URL ?? '',
  baseBetaUrl: env.VITE_BASE_BETA_URL ?? '',
  facebookUrl: env.VITE_FACEBOOK_URL ?? '',
  instagramUrl: env.VITE_INSTAGRAM_URL ?? '',
  twitterUrl: env.VITE_TWITTER_URL ?? '',
  soundcloudUrl: env.VITE_SOUNDCLOUD_URL ?? '',
  serverBackend: env.VITE_SERVER_BACKEND ?? '',
  serverMedia: env.VITE_SERVER_MEDIA ?? '',
  mode: env.MODE ?? 'development'
}

export const BASE_LANDING_URL = CONFIG.baseLandingUrl
export const BASE_BETA_URL = CONFIG.baseBetaUrl
export const FACEBOOK_URL = CONFIG.facebookUrl
export const INSTAGRAM_URL = CONFIG.instagramUrl
export const TWITTER_URL = CONFIG.twitterUrl
export const SOUNDCLOUD_URL = CONFIG.soundcloudUrl
export const SERVER_BACKEND = CONFIG.serverBackend
export const SERVER_MEDIA = CONFIG.serverMedia
