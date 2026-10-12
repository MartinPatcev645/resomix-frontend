import type { MetadataRoute } from 'next'
import { assertLastmod, canonicalUrl, SITEMAP_DEFAULTS, sitemapRoutes } from '@/lib/seo'

export const dynamic = 'force-static'

/* Every entry comes from ROUTE_SEO, and `lastmod` is the page's content date, never the build
   clock. The guard throws during `next build`, so a page cannot ship without a real date. */
export default function sitemap(): MetadataRoute.Sitemap {
  const today = new Date().toISOString().slice(0, 10)
  return sitemapRoutes().map((route) => ({
    url: canonicalUrl(route.path),
    lastModified: assertLastmod(route.path, route.lastmod, today),
    changeFrequency: route.changefreq ?? SITEMAP_DEFAULTS.changefreq,
    priority: route.priority ?? SITEMAP_DEFAULTS.priority,
  }))
}
