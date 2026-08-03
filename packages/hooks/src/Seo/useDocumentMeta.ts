import { useEffect } from 'react';

/**
 * Writes the document head for the current route: title, description, canonical, robots, Open Graph
 * and Twitter tags.
 *
 * Shared because landing and the webapp had the same gap — a static head in index.html that every
 * route inherited, so each app declared all of its URLs to be the same page. The per-route DATA
 * lives in each app (`src/routes/seoConfig.ts`); only the DOM writing lives here.
 *
 * WHAT THIS CANNOT DO: it runs in the browser. Googlebot executes JavaScript and will see these
 * tags, but the Open Graph scrapers behind Slack, WhatsApp, iMessage, LinkedIn and Facebook do not —
 * they read the raw HTML response. Link previews therefore always come from the static tags in
 * index.html, which is why those must stay accurate at the site level. Per-page previews require
 * prerendering.
 */

export interface DocumentMeta {
  title: string;
  description: string;
  /** Absolute URL. Relative canonicals are legal but are a common source of self-referencing bugs. */
  canonical: string;
  /** Absolute URL — crawlers do not resolve relative OG images. */
  image: string;
  /** Keep the page out of the index. Links are still followed, so link equity is not stranded. */
  noindex?: boolean;
  ogType?: string;
  siteName?: string;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
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

/** Absolute URL for a path, with any trailing slash collapsed so `/x` and `/x/` are one page. */
export function absoluteUrl(origin: string, pathname: string): string {
  const path = pathname !== '/' && pathname.endsWith('/') ? pathname.replace(/\/+$/, '') : pathname;
  return `${origin.replace(/\/$/, '')}${path}`;
}

export function useDocumentMeta(meta: DocumentMeta): void {
  const { title, description, canonical, image, noindex, ogType = 'website', siteName } = meta;

  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow');
    upsertLink('canonical', canonical);

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:image', image);
    if (siteName) upsertMeta('property', 'og:site_name', siteName);

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);
  }, [title, description, canonical, image, noindex, ogType, siteName]);
}
