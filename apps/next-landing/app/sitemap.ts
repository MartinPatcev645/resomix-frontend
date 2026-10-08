import type { MetadataRoute } from 'next'
import { HOME_SEO, SITE_ORIGIN } from '@/lib/site'

export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_ORIGIN}/`,
      lastModified: HOME_SEO.lastmod,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]
}
