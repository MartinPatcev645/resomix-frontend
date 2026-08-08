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
  demoMode: boolean
  /** The Journal. Its own subdomain, not a path on the marketing site. */
  blogUrl: string
}

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env

export const CONFIG: AppConfig = {
  baseLandingUrl: env.VITE_BASE_LANDING_URL ?? '',
  baseBetaUrl: env.VITE_BASE_BETA_URL ?? '',
  // Ghost is hosted separately, so this is NOT `${baseLandingUrl}/blog` — writing it that way sent
  // every Journal link through a redirect on the marketing origin. Overridable, but the default is
  // the real host so a missing env var cannot silently break the link.
  blogUrl: env.VITE_BLOG_URL ?? 'https://blog.resomix.com',
  facebookUrl: env.VITE_FACEBOOK_URL ?? '',
  instagramUrl: env.VITE_INSTAGRAM_URL ?? '',
  twitterUrl: env.VITE_TWITTER_URL ?? '',
  soundcloudUrl: env.VITE_SOUNDCLOUD_URL ?? '',
  serverBackend: env.VITE_SERVER_BACKEND ?? '',
  serverMedia: env.VITE_SERVER_MEDIA ?? '',
  mode: env.MODE ?? 'development',
  demoMode: (env.VITE_DEMO_MODE ?? 'false').toLowerCase() === 'true'
}

export const BASE_LANDING_URL = CONFIG.baseLandingUrl
export const BASE_BETA_URL = CONFIG.baseBetaUrl
export const BLOG_URL = CONFIG.blogUrl
export const FACEBOOK_URL = CONFIG.facebookUrl
export const INSTAGRAM_URL = CONFIG.instagramUrl
export const TWITTER_URL = CONFIG.twitterUrl
export const SOUNDCLOUD_URL = CONFIG.soundcloudUrl
export const SERVER_BACKEND = CONFIG.serverBackend
export const SERVER_MEDIA = CONFIG.serverMedia
export const DEMO_MODE = CONFIG.demoMode
