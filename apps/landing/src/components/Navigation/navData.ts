import { BASE_BETA_URL, BLOG_URL } from '@resomix/config';
import type { NavGlyphKey } from './NavGlyphs.tsx';

/** BASE_BETA_URL is env-driven and empty when VITE_BASE_BETA_URL is unset — never ship an empty CTA target. */
export const BETA_URL = BASE_BETA_URL || 'https://beta.resomix.com';

/**
 * The analysis tool. The beta root lands on Sonic Discovery, so any CTA that promises analysis
 * ("Analyse a Track") has to name this route explicitly. Built off the guarded BETA_URL — with a
 * bare BASE_BETA_URL an unset env would turn this into a same-origin `/analysis` on the marketing
 * site — and the trailing slash is trimmed in case the env value carries one.
 */
export const BETA_ANALYSIS_URL = `${BETA_URL.replace(/\/$/, '')}/analysis`;

export type NavStatus = 'coming-next' | 'scoping-available';

export interface NavItem {
  key: string;
  glyph?: NavGlyphKey;
  live: boolean;
  route?: string;
  plannedRoute?: string;
  external?: boolean;
  externalAriaKey?: string;
  status?: NavStatus;
  featured?: boolean;
  /** Opens the Silktide consent manager instead of navigating. Has no route. */
  isCookieSettings?: boolean;
}

export interface NavColumn {
  /** Omit for an unlabelled column — the panel then renders the list with no heading. */
  groupLabelKey?: string;
  flex?: string;
  items: NavItem[];
  featured?: NavItem;
  notice?: NavPanelNotice;
}

export interface NavPanelNotice {
  titleKey: string;
  bodyKey: string;
}

export interface NavTopGroup {
  key: 'product' | 'solutions' | 'partners' | 'developers' | 'company';
  side: 'left' | 'right';
  panelId: string;
  panelWidth: string;
  compactPanelWidth?: string;
  columns?: NavColumn[];
  featured?: NavItem;
  groupLabelKey?: string;
  items?: NavItem[];
  noteKey?: string;
}

export const NAV_TOP_GROUPS: NavTopGroup[] = [
  {
    key: 'product',
    side: 'left',
    panelId: 'panel-product',
    panelWidth: '38rem',
    featured: {
      key: 'platform',
      live: true,
      route: '/product',
      featured: true,
    },
    groupLabelKey: 'productRoutes',
    items: [
      { key: 'sonic-discovery', glyph: 'sonic-discovery', live: true, route: '/product/sonic-discovery' },
      { key: 'track-intelligence', glyph: 'track-intelligence', live: true, route: '/product/track-intelligence' },
      { key: 'catalogue-intelligence', glyph: 'catalogue-intelligence', live: true, route: '/product/catalog-intelligence' },
    ],
    noteKey: 'pyxisNote',
  },
  {
    key: 'solutions',
    side: 'left',
    panelId: 'panel-solutions',
    panelWidth: '44rem',
    compactPanelWidth: '41rem',
    columns: [
      {
        groupLabelKey: 'rightsCatalogueLicensing',
        flex: '1 1 52%',
        items: [
          { key: 'record-labels', glyph: 'record-labels', live: true, route: '/solutions/record-labels' },
          { key: 'music-publishers', glyph: 'music-publishers', live: true, route: '/solutions/music-publishers' },
          { key: 'sync-agencies', glyph: 'sync-agencies', live: true, route: '/solutions/sync-agencies' },
          { key: 'music-libraries', glyph: 'music-libraries', live: true, route: '/solutions/music-libraries-sample-providers' },
        ],
      },
      {
        groupLabelKey: 'musicProfessionals',
        flex: '1 1 48%',
        featured: {
          key: 'djs',
          live: true,
          route: '/solutions/djs',
          featured: true,
        },
        items: [
          { key: 'music-curators', glyph: 'music-curators', live: true, route: '/solutions/music-curators' },
          { key: 'producers', glyph: 'producers', live: true, route: '/solutions/producers' },
        ],
      },
    ],
    noteKey: 'plannedPagesNote',
  },
  {
    // Company sits on the LEFT with Product and Solutions: it is about Resomix itself, not about
    // what a partner buys. Same panel shape as every other group so the dropdown looks identical.
    key: 'company',
    side: 'left',
    panelId: 'panel-company',
    // Matches Solutions, the widest panel. At 34rem the two columns were cramped enough that
    // titles wrapped.
    panelWidth: '44rem',
    columns: [
      {
        // Unlabelled: the trigger already says "Resources", so a "Resources" heading directly
        // under it was the same word twice.
        flex: '1 1 50%',
        items: [
          { key: 'journal', glyph: 'journal', live: true, route: BLOG_URL, external: true, externalAriaKey: 'journalAria' },
          { key: 'help-centre', glyph: 'help', live: true, route: 'https://support.resomix.com', external: true, externalAriaKey: 'helpCentreAria' },
          { key: 'faq', glyph: 'help', live: true, route: 'https://support.resomix.com', external: true, externalAriaKey: 'faqAria' },
          { key: 'legal-documents', glyph: 'legal', live: true, route: 'https://support.resomix.com/hc/categories/1/3/legal', external: true, externalAriaKey: 'legalDocumentsAria' },
        ],
      },
      {
        groupLabelKey: 'company',
        flex: '1 1 50%',
        items: [
          { key: 'home', glyph: 'resomix', live: true, route: '/' },
          { key: 'about', glyph: 'about', live: true, route: '/about' },
          { key: 'contact', glyph: 'contact', live: true, route: '/contact' },
          // Trust, Rights & Security is not here: it already sits in the Partners panel, and a
          // link that appears in two dropdowns makes both look like they are guessing.
          { key: 'cookie-settings', glyph: 'legal', live: true, isCookieSettings: true },
        ],
      },
    ],
  },
  {
    key: 'partners',
    side: 'right',
    panelId: 'panel-partners',
    panelWidth: '40rem',
    columns: [
      {
        groupLabelKey: 'startAndEvaluate',
        flex: '1 1 50%',
        items: [
          { key: 'partner-overview', glyph: 'partner-overview', live: true, route: '/partners' },
          { key: 'private-catalogue-pilot', glyph: 'pilot', live: true, route: '/partners/pilot' },
          { key: 'contact-partnerships', glyph: 'contact', live: true, route: '/partners#contact' },
        ],
      },
      {
        groupLabelKey: 'trustAndDeployment',
        flex: '1 1 50%',
        items: [
          { key: 'trust-rights-security', glyph: 'trust', live: true, route: '/trust' },
          { key: 'api-catalogue-ingestion', glyph: 'code-brackets', live: true, route: '/developers' },
          { key: 'integration-planning', glyph: 'integration-planning', live: true, route: '/partners#contact', status: 'scoping-available' },
        ],
      },
    ],
  },
  {
    key: 'developers',
    side: 'right',
    panelId: 'panel-developers',
    panelWidth: '36rem',
    columns: [
      {
        groupLabelKey: 'build',
        flex: '1 1 54%',
        items: [
          { key: 'developers-overview', glyph: 'code-brackets', live: true, route: '/developers' },
          { key: 'full-api-reference', glyph: 'api-reference', live: true, route: 'https://api-docs.resomix.com', external: true, externalAriaKey: 'fullApiReferenceAria' },
          { key: 'catalogue-ingestion', glyph: 'catalogue-ingestion', live: true, route: '/developers#dev-ingestion' },
          { key: 'track-analysis-schema', glyph: 'analysis-schema', live: true, route: '/developers#dev-schema' },
        ],
      },
      {
        groupLabelKey: 'evaluate',
        flex: '1 1 46%',
        items: [
          { key: 'request-api-access', glyph: 'request-api', live: true, route: '/partners/pilot' },
        ],
        notice: {
          titleKey: 'noPublicSandboxTitle',
          bodyKey: 'noPublicSandboxBody',
        },
      },
    ],
  },
];

export interface NavUtilityLink {
  key: string;
  route: string;
  external?: boolean;
  externalAriaKey?: string;
  isCookieSettings?: boolean;
}

export const NAV_UTILITY_LINKS: NavUtilityLink[] = [
  // Mirrors the beta app's drawer, which lists Home first. Here it is an in-app route ('/'),
  // since the landing site IS resomix.com — no full page load needed.
  { key: 'home', route: '/' },
  { key: 'about', route: '/about' },
  { key: 'journal', route: BLOG_URL, external: true, externalAriaKey: 'journalAria' },
  // TODO: confirm per-section support URLs
  { key: 'help-centre', route: 'https://support.resomix.com', external: true, externalAriaKey: 'helpCentreAria' },
  // TODO: confirm per-section support URLs
  { key: 'faq', route: 'https://support.resomix.com', external: true, externalAriaKey: 'faqAria' },
  { key: 'legal-documents', route: 'https://support.resomix.com/hc/categories/1/3/legal', external: true, externalAriaKey: 'legalDocumentsAria' },
  { key: 'trust', route: '/trust' },
  // Grouped with the other company links rather than appended, so Cookie Settings stays last.
  { key: 'contact', route: '/contact' },
  { key: 'cookie-settings', route: '', isCookieSettings: true },
];

export const NAV_CTA = {
  tryResomix: { route: '', external: true, useBetaUrl: true },
  startPilot: { route: '/partners/pilot' },
} as const;

export type NavSectionKey = NavTopGroup['key'];

export function getNavSectionForPath(pathname: string): NavSectionKey | null {
  if (pathname.startsWith('/product')) return 'product';
  if (pathname.startsWith('/partners') || pathname === '/trust') return 'partners';
  if (pathname.startsWith('/developers')) return 'developers';
  return null;
}

export function isCurrentNavRoute(pathname: string, hash: string, route?: string): boolean {
  if (!route || !route.startsWith('/')) return false;
  const [routePath, routeHash = ''] = route.split('#');
  if (pathname !== routePath) return false;
  if (routeHash) return hash === `#${routeHash}`;
  return !hash;
}

export const ALLOWED_EXTERNAL_URLS = [
  'https://api-docs.resomix.com',
  BLOG_URL,
  'https://support.resomix.com',
  'https://support.resomix.com/hc/categories/1/3/legal',
] as const;
