import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_SEO, OG_IMAGE, ROUTE_SEO, SITE_ORIGIN, type RouteSeo } from '@/routes/seoConfig.ts';

/**
 * Keeps the document head in step with the route.
 *
 * Replaces sixteen separate `document.title` effects, each of which set only the title — so every
 * page shared the homepage's description and, worse, the homepage's canonical: index.html hardcoded
 * `<link rel="canonical" href="https://resomix.com/">`, which told search engines that all twenty
 * URLs were the same page.
 *
 * Mounted once, next to <Routes>, so no page has to remember to do this.
 *
 * LIMIT WORTH KNOWING: this runs in the browser. Googlebot renders JavaScript and will see it, but
 * the OG scrapers behind Slack, WhatsApp, iMessage, LinkedIn and Facebook do NOT — they read the
 * raw HTML. Those previews therefore fall back to the static defaults in index.html, which is why
 * those defaults are worth keeping accurate. Per-page social previews need prerendering.
 */

/** Create the tag on first use so index.html only has to carry the defaults. */
function upsertMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/** Trailing slashes make `/trust` and `/trust/` look like two pages; canonicalise on the bare path. */
export function canonicalUrlFor(pathname: string): string {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return `${SITE_ORIGIN}${path}`;
}

/** Route → metadata, falling back to the 404 entry for anything unrecognised. */
export function seoFor(pathname: string): RouteSeo {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return ROUTE_SEO[path] ?? ROUTE_SEO['/404'] ?? DEFAULT_SEO;
}

export function RouteMeta() {
  const { pathname } = useLocation();

  useEffect(() => {
    const seo = seoFor(pathname);
    const url = canonicalUrlFor(pathname);

    document.title = seo.title;
    upsertMeta('meta[name="description"]', 'name', 'description', seo.description);

    // An unknown path is the 404 view; it must never be indexed under whatever URL was typed.
    upsertMeta(
      'meta[name="robots"]',
      'name',
      'robots',
      seo.noindex ? 'noindex, follow' : 'index, follow',
    );

    // Canonical: without this every route inherits index.html's homepage canonical.
    upsertLink('canonical', url);

    upsertMeta('meta[property="og:title"]', 'property', 'og:title', seo.title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', seo.description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', url);
    upsertMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', OG_IMAGE);

    upsertMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', seo.title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', seo.description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', OG_IMAGE);
  }, [pathname]);

  return null;
}
