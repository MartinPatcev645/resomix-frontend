import type { Metadata } from 'next'
import { SiteChrome } from '@/components/shell'
import { core } from '@/lib/i18n'
import { homeJsonLd } from '@/lib/jsonld'
import { canonicalUrl, routeMetadata } from '@/lib/seo'
import { Home } from '@/sections/home'

/**
 * Canonical and og:url are tags here, not `alternates.canonical`/`openGraph.url`. Next's
 * resolveAbsoluteUrlWithPathname (next/dist/lib/metadata/resolvers/resolve-url.js) rewrites any URL
 * whose pathname is `/` to its bare origin, absolute input included, and only re-adds the slash
 * when `trailingSlash` is on. The public canonical for `/` is `https://resomix.com/`. Other routes
 * get theirs from routeMetadata.
 */
const CANONICAL = canonicalUrl('/')

export const metadata: Metadata = routeMetadata('/')

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
