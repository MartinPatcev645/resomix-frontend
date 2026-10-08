import type { Metadata } from 'next'
import { OG_IMAGE, SITE_ORIGIN } from './site'

/**
 * Per-route SEO metadata: the single source for each page's head AND the sitemap.
 *
 * Mirrors apps/landing/src/routes/seoConfig.ts. Keeping both derived from one map means a new page
 * cannot ship with a stale sitemap or an inherited homepage title. Add every new route here.
 */

export interface RouteSeo {
  title: string
  description: string
  /**
   * The day this page's content last genuinely changed, as `YYYY-MM-DD`.
   *
   * CHANGE THIS WHEN YOU CHANGE THE PAGE, and at no other time. It is not a deploy stamp: Google
   * discounts a lastmod that moves while the page does not. Required on every indexable route;
   * the sitemap build fails on a missing, malformed or future date.
   */
  lastmod?: string
  /** Sitemap hints. Omit to use SITEMAP_DEFAULTS. */
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority?: number
  /** Real route, but must stay out of the index and the sitemap. */
  noindex?: boolean
}

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Resomix: Find & Analyse Electronic Music by Sound',
    description:
      'Resomix finds electronic music by how it sounds. Drop one track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue.',
    changefreq: 'weekly',
    lastmod: '2026-10-03',
    priority: 1,
  },
}

export const SITEMAP_DEFAULTS = { changefreq: 'monthly' as const, priority: 0.8 }

/** Public canonical. `/` keeps its slash; every other route is unsuffixed (`trailingSlash: false`). */
export function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`
}

/** The routes that belong in the sitemap: everything registered, minus the noindexed ones. */
export function sitemapRoutes(): Array<{ path: string } & RouteSeo> {
  return Object.entries(ROUTE_SEO)
    .filter(([, seo]) => !seo.noindex)
    .map(([path, seo]) => ({ path, ...seo }))
}

/** Throws unless `lastmod` is a real `YYYY-MM-DD` date that is not after `today`. */
export function assertLastmod(path: string, lastmod: string | undefined, today: string): string {
  if (!lastmod || !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
    throw new Error(
      `sitemap: ${path} needs a lastmod of the form YYYY-MM-DD in lib/seo.ts ` +
        `(got ${JSON.stringify(lastmod)}). Set it to the day the page last changed.`,
    )
  }
  if (lastmod > today) {
    throw new Error(`sitemap: ${path} has a lastmod in the future (${lastmod}).`)
  }
  return lastmod
}

/**
 * Page metadata for a registered route. The root route's canonical and og:url are written as tags
 * by the page instead, because the Metadata API drops the slash from a root URL (see app/page.tsx).
 */
export function routeMetadata(path: string): Metadata {
  const seo = ROUTE_SEO[path]
  if (!seo) throw new Error(`No ROUTE_SEO entry for ${path}. Add one in lib/seo.ts.`)
  const url = path === '/' ? undefined : canonicalUrl(path)

  return {
    title: seo.title,
    description: seo.description,
    robots: seo.noindex ? { index: false, follow: false } : { index: true, follow: true },
    ...(url && { alternates: { canonical: url } }),
    openGraph: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      siteName: 'Resomix',
      locale: 'en_US',
      ...(url && { url }),
      images: [{ url: OG_IMAGE, alt: 'Resomix — sonic intelligence platform' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [OG_IMAGE],
    },
  }
}
