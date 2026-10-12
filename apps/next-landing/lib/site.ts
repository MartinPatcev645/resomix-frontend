/**
 * Production origin for canonicals, Open Graph, and the sitemap.
 * Override with NEXT_PUBLIC_SITE_ORIGIN only when this Pages project should
 * stop pointing at https://resomix.com.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://resomix.com').replace(/\/$/, '')

/** Beta app. Matches apps/landing/.env.production when the env var is unset. */
export const BETA_URL = (process.env.NEXT_PUBLIC_BASE_BETA_URL ?? 'https://beta.resomix.com').replace(/\/$/, '')

export const BLOG_URL = 'https://blog.resomix.com'

/** Google Tag Manager container. Matches VITE_GTM_ID's fallback in apps/landing. */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? 'GTM-PD9XQZRV'

export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`
