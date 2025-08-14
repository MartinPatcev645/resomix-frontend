declare interface ImportMetaEnv {
  readonly VITE_BASE_LANDING_URL?: string
  readonly VITE_BASE_BETA_URL?: string
  readonly VITE_FACEBOOK_URL?: string
  readonly VITE_INSTAGRAM_URL?: string
  readonly VITE_TWITTER_URL?: string
  readonly VITE_SOUNDCLOUD_URL?: string
  readonly VITE_SERVER_BACKEND?: string
  readonly VITE_SERVER_MEDIA?: string
  readonly MODE?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
