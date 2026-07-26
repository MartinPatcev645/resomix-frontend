import type { NavGlyphKey } from './NavGlyphs.tsx';

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
}

export interface NavColumn {
  groupLabelKey: string;
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
  key: 'product' | 'solutions' | 'partners' | 'developers';
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
      { key: 'catalogue-intelligence', glyph: 'catalogue-intelligence', live: true, route: '/product/catalogue-intelligence' },
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
          { key: 'record-labels', glyph: 'record-labels', live: false, plannedRoute: '/solutions/record-labels', status: 'coming-next' },
          { key: 'music-publishers', glyph: 'music-publishers', live: false, plannedRoute: '/solutions/music-publishers', status: 'coming-next' },
          { key: 'sync-agencies', glyph: 'sync-agencies', live: false, plannedRoute: '/solutions/sync-agencies', status: 'coming-next' },
          { key: 'music-libraries', glyph: 'music-libraries', live: false, plannedRoute: '/solutions/music-libraries-sample-providers', status: 'coming-next' },
        ],
      },
      {
        groupLabelKey: 'musicProfessionals',
        flex: '1 1 48%',
        featured: {
          key: 'djs',
          live: false,
          plannedRoute: '/solutions/djs',
          status: 'coming-next',
          featured: true,
        },
        items: [
          { key: 'music-curators', glyph: 'music-curators', live: false, plannedRoute: '/solutions/music-curators', status: 'coming-next' },
          { key: 'producers', glyph: 'producers', live: false, plannedRoute: '/solutions/producers', status: 'coming-next' },
        ],
      },
    ],
    noteKey: 'plannedPagesNote',
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
  { key: 'about', route: '/about' },
  { key: 'journal', route: 'https://resomix.com/blog', external: true, externalAriaKey: 'journalAria' },
  // TODO: confirm per-section support URLs
  { key: 'help-centre', route: 'https://support.resomix.com', external: true, externalAriaKey: 'helpCentreAria' },
  // TODO: confirm per-section support URLs
  { key: 'faq', route: 'https://support.resomix.com', external: true, externalAriaKey: 'faqAria' },
  { key: 'legal-documents', route: 'https://support.resomix.com/hc/categories/1/3/legal', external: true, externalAriaKey: 'legalDocumentsAria' },
  { key: 'trust', route: '/trust' },
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
  'https://resomix.com/blog',
  'https://support.resomix.com',
  'https://support.resomix.com/hc/categories/1/3/legal',
] as const;
