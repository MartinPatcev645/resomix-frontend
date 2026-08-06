/**
 * Per-route SEO metadata for the app at beta.resomix.com — the single source for the document head
 * AND the sitemap.
 *
 * The app used to be blanket `noindex, nofollow` in index.html while robots.txt simultaneously
 * invited crawling and published a sitemap advertising four URLs. It now allows crawling properly,
 * which makes two things load-bearing:
 *
 *  1. WHAT NOT TO INDEX. Most of this app is a signed-in workspace. A crawler hitting /library or
 *     /profile sees a redirect or an empty shell, and Google explicitly advises against indexing
 *     sign-in screens. Those are `noindex` — crawlable, so the tag is actually seen, but kept out
 *     of the index rather than blocked in robots.txt (a blocked page's noindex is never read).
 *
 *  2. DUPLICATE CONTENT. `/subscribe` and `/contact` render the *same shared components* as
 *     resomix.com. Two origins serving identical pages is exactly what makes a search engine pick
 *     one arbitrarily and split the signals. Both carry a cross-origin canonical pointing at the
 *     marketing site, which is the version we want ranking.
 */

/** Production origin for this app. */
export const SITE_ORIGIN = 'https://beta.resomix.com';

/** The marketing site, for cross-origin canonicals on pages shared between the two. */
export const LANDING_ORIGIN = 'https://resomix.com';

export interface RouteSeo {
  title: string;
  description: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
  /** Crawlable but kept out of the index: private, transient, or a duplicate. */
  noindex?: boolean;
  /**
   * Absolute canonical override. Used where this app renders a page that also exists on the
   * marketing site, so the ranking signal consolidates there instead of competing.
   */
  canonical?: string;
}

export const ROUTE_SEO: Record<string, RouteSeo> = {
  '/': {
    title: 'Resomix: Find Tracks by Sound',
    description:
      'Drop a reference track and get ranked matches that actually belong next to it. Sonic discovery, track analysis and playlists in one workspace.',
    changefreq: 'weekly',
    priority: 1.0,
  },
  '/sonic-discovery': {
    title: 'Sonic Discovery: Search by Reference | Resomix',
    description:
      'Search the catalogue by sound rather than tags: upload or pick a reference and explore what sits next to it.',
    changefreq: 'weekly',
    priority: 0.9,
  },
  '/analysis': {
    title: 'Track Analysis: See What a Track Is Made Of | Resomix',
    description:
      'Upload a track to read its tempo, key, energy and sonic character, then jump straight to similar recordings.',
    changefreq: 'weekly',
    priority: 0.9,
  },

  /* The full Track Intelligence dashboard. `noindex` on purpose: it is only ever reachable with a
     specific `?id=`, it is a Pro capability, and an indexed shell with no analysis behind it would
     be a dead result. `/analysis` is the page that should rank. */
  '/analysis/full': {
    title: 'Full Track Intelligence | Resomix',
    description:
      'The complete breakdown of a track: spectrograms, chromagram, beat and phrase grids, mood and genre over time, and stem composition.',
    noindex: true,
  },

  /* ---------- shared with the marketing site: canonical points there ---------- */
  '/subscribe': {
    title: 'Subscribe to Resomix: Unlock Deeper Sonic Discovery',
    description:
      'Upgrade your Resomix plan for expanded discovery and analysis, and manage billing securely. Start in the free production beta and grow when you are ready.',
    canonical: `${LANDING_ORIGIN}/subscribe`,
    priority: 0.6,
  },
  '/contact': {
    title: 'Contact Resomix: Support, Partnerships and Press Enquiries',
    description:
      'Reach the Resomix team in Thessaloniki for product support, partner and catalogue enquiries, or press. We reply from support@resomix.com within the beta.',
    canonical: `${LANDING_ORIGIN}/contact`,
    priority: 0.5,
  },

  /* ---------- signed-in workspace: crawlable, never indexed ---------- */
  // A crawler sees a redirect or an empty shell here; indexing it would put a blank page in results.
  '/library': { title: 'Your Library | Resomix', description: 'Your saved playlists and uploads.', noindex: true },
  '/profile': { title: 'Your Profile | Resomix', description: 'Account, plan and billing settings.', noindex: true },
  '/sessions': { title: 'Active Sessions | Resomix', description: 'Devices signed in to your account.', noindex: true },
  '/change-password': { title: 'Change Password | Resomix', description: 'Update your account password.', noindex: true },

  /* ---------- auth screens: Google advises against indexing sign-in pages ---------- */
  '/auth/login': { title: 'Sign In | Resomix', description: 'Sign in to your Resomix account.', noindex: true },
  '/auth/register': { title: 'Create an Account | Resomix', description: 'Create a Resomix account.', noindex: true },
  '/auth/forgot-password': { title: 'Reset Your Password | Resomix', description: 'Request a password reset link.', noindex: true },
  '/auth/reset-password': { title: 'Set a New Password | Resomix', description: 'Choose a new account password.', noindex: true },
  '/auth/verify-email': { title: 'Verify Your Email | Resomix', description: 'Confirm your email address.', noindex: true },
  '/auth/verify-2fa': { title: 'Two-Factor Verification | Resomix', description: 'Enter your verification code.', noindex: true },

  /* ---------- transient ---------- */
  '/error': { title: 'Something went wrong | Resomix', description: 'An unexpected error occurred.', noindex: true },
  '/loader': { title: 'Processing your upload | Resomix', description: 'Your upload is being analysed.', noindex: true },
  '/playlist': { title: 'Playlist | Resomix', description: 'Redirecting to the discovery workspace.', noindex: true },
  '/404': { title: 'Page not found | Resomix', description: 'That page does not exist.', noindex: true },
};

export const SITEMAP_DEFAULTS = { changefreq: 'monthly' as const, priority: 0.7 };

/**
 * Social preview image. Absolute — crawlers do not resolve relative OG URLs.
 * 1200x630 landscape card, matching the marketing site.
 */
export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

/**
 * Sitemap contents: indexable pages only.
 *
 * A canonical-elsewhere page is deliberately excluded too — listing a URL whose canonical points at
 * another origin asks a crawler to index something we have just told it not to prefer.
 */
export function sitemapRoutes(): Array<{ path: string } & RouteSeo> {
  return Object.entries(ROUTE_SEO)
    .filter(([, seo]) => !seo.noindex && !seo.canonical)
    .map(([path, seo]) => ({ path, ...seo }));
}
