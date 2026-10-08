import type { Metadata } from 'next'
import { SiteChrome } from '@/components/shell/SiteChrome'
import { core } from '@/lib/i18n'
import { homeJsonLd } from '@/lib/jsonld'
import { HOME_SEO, OG_IMAGE, SITE_ORIGIN } from '@/lib/site'
import { Home } from '@/sections/home/Home'

/**
 * Written as tags rather than Metadata fields. With `trailingSlash: false`,
 * Next resolves a root URL to the origin with no slash. The public canonical
 * for `/` stays `https://resomix.com/`.
 */
const CANONICAL = `${SITE_ORIGIN}/`

export const metadata: Metadata = {
  title: HOME_SEO.title,
  description: HOME_SEO.description,
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    siteName: 'Resomix',
    locale: 'en_US',
    images: [{ url: OG_IMAGE, alt: 'Resomix — sonic intelligence platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_SEO.title,
    description: HOME_SEO.description,
    images: [OG_IMAGE],
  },
}

export default function Page() {
  return (
    <>
      <link rel="canonical" href={CANONICAL} />
      <meta property="og:url" content={CANONICAL} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd()) }} />
      <SiteChrome copy={core}>
        <Home />
      </SiteChrome>
    </>
  )
}
