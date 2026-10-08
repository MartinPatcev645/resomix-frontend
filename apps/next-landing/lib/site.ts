/**
 * Production origin for canonicals, Open Graph, and the sitemap.
 * Override with NEXT_PUBLIC_SITE_ORIGIN only when this Pages project should
 * stop pointing at https://resomix.com.
 */
export const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_ORIGIN ?? 'https://resomix.com').replace(/\/$/, '')

/** Beta app. Matches apps/landing/.env.production when the env var is unset. */
export const BETA_URL = (process.env.NEXT_PUBLIC_BASE_BETA_URL ?? 'https://beta.resomix.com').replace(/\/$/, '')

export const BLOG_URL = 'https://blog.resomix.com'

export const HOME_SEO = {
  title: 'Resomix: Find & Analyse Electronic Music by Sound',
  description:
    'Resomix finds electronic music by how it sounds. Drop one track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue.',
  lastmod: '2026-10-03',
} as const

export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`
