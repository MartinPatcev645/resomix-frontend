import { useLocation } from 'react-router-dom';
import { absoluteUrl, useDocumentMeta } from '@resomix/hooks';
import { OG_IMAGE, ROUTE_SEO, SITE_ORIGIN, type RouteSeo } from '@/routes/seoConfig.ts';

/**
 * Keeps the document head in step with the route.
 *
 * Replaces sixteen separate `document.title` effects, each of which set only the title — so every
 * page shared the homepage's description and, worse, the homepage's canonical: index.html hardcoded
 * `<link rel="canonical" href="https://resomix.com/">`, which told search engines that all twenty
 * URLs were the same page.
 *
 * Mounted once, next to <Routes>, so no page has to remember to do this.
 */

/** Route → metadata, falling back to the 404 entry for anything unrecognised. */
export function seoFor(pathname: string): RouteSeo {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_SEO[path] ?? ROUTE_SEO['/404'];
}

/** Trailing slashes make `/trust` and `/trust/` look like two pages; canonicalise on the bare path. */
export function canonicalUrlFor(pathname: string): string {
  return absoluteUrl(SITE_ORIGIN, pathname);
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
