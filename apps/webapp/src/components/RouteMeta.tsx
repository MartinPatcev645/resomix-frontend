import { useLocation } from 'react-router-dom';
import { absoluteUrl, useDocumentMeta } from '@resomix/hooks';
import { OG_IMAGE, ROUTE_SEO, SITE_ORIGIN, type RouteSeo } from '@/routes/seoConfig.ts';

/**
 * Keeps the document head in step with the route.
 *
 * The app previously shipped a single static head with `noindex, nofollow` on every URL. Now that
 * crawling is allowed, each route needs its own title, description and canonical — and the private
 * ones need their own `noindex`, since a blanket one no longer exists to cover them.
 *
 * Mounted once, next to <Routes>.
 */

/** Route → metadata, falling back to the 404 entry for anything unrecognised. */
export function seoFor(pathname: string): RouteSeo {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_SEO[path] ?? ROUTE_SEO['/404'];
}

/**
 * Canonical for a path. Pages that also exist on the marketing site declare an absolute override
 * pointing there, so the two origins stop competing for the same query.
 */
export function canonicalUrlFor(pathname: string): string {
  return seoFor(pathname).canonical ?? absoluteUrl(SITE_ORIGIN, pathname);
}

export function RouteMeta() {
  const { pathname } = useLocation();
  const seo = seoFor(pathname);

  useDocumentMeta({
    title: seo.title,
    description: seo.description,
    canonical: canonicalUrlFor(pathname),
    image: OG_IMAGE,
    noindex: seo.noindex,
    siteName: 'Resomix',
  });

  return null;
}
