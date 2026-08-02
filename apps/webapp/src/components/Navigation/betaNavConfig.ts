import { BASE_BETA_URL, BASE_LANDING_URL } from '@resomix/config';
import type { NavGlyphKey } from './NavGlyphs.tsx';

/**
 * Beta webapp navigation config — copy of landing navData with absolute landing URLs.
 * Drift from apps/landing/src/components/Navigation/navData.ts is accepted until a
 * future shared-package consolidation task.
 */

export const BETA_URL = BASE_BETA_URL || 'https://beta.resomix.com';

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

/** Prefix a landing-relative path with BASE_LANDING_URL for full-page cross-domain navigation. */
export function landingHref(path: string): string {
  if (!path || path.startsWith('http')) return path;
  const base = BASE_LANDING_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const CATALOGUE_PILOT_HREF = landingHref('/partners/pilot');

export const ABOUT_HREF = landingHref('/about');

export const NAV_TOP_GROUPS: NavTopGroup[] = [
  {
    key: 'product',
    side: 'left',
    panelId: 'panel-product',
    panelWidth: '38rem',
    featured: {
      key: 'platform',
      live: true,
      route: landingHref('/product'),
      featured: true,
    },
    groupLabelKey: 'productRoutes',
    items: [
      { key: 'sonic-discovery', glyph: 'sonic-discovery', live: true, route: landingHref('/product/sonic-discovery') },
      { key: 'track-intelligence', glyph: 'track-intelligence', live: true, route: landingHref('/product/track-intelligence') },
      { key: 'catalogue-intelligence', glyph: 'catalogue-intelligence', live: true, route: landingHref('/product/catalog-intelligence') },
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
          { key: 'record-labels', glyph: 'record-labels', live: true, route: landingHref('/solutions/record-labels') },
          { key: 'music-publishers', glyph: 'music-publishers', live: true, route: landingHref('/solutions/music-publishers') },
          { key: 'sync-agencies', glyph: 'sync-agencies', live: true, route: landingHref('/solutions/sync-agencies') },
          { key: 'music-libraries', glyph: 'music-libraries', live: true, route: landingHref('/solutions/music-libraries-sample-providers') },
        ],
      },
      {
        groupLabelKey: 'musicProfessionals',
        flex: '1 1 48%',
        featured: {
          key: 'djs',
          live: true,
          route: landingHref('/solutions/djs'),
          featured: true,
        },
        items: [
          { key: 'music-curators', glyph: 'music-curators', live: true, route: landingHref('/solutions/music-curators') },
          { key: 'producers', glyph: 'producers', live: true, route: landingHref('/solutions/producers') },
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
          { key: 'partner-overview', glyph: 'partner-overview', live: true, route: landingHref('/partners') },
          { key: 'private-catalogue-pilot', glyph: 'pilot', live: true, route: landingHref('/partners/pilot') },
          { key: 'contact-partnerships', glyph: 'contact', live: true, route: landingHref('/partners#contact') },
        ],
      },
      {
        groupLabelKey: 'trustAndDeployment',
        flex: '1 1 50%',
        items: [
          { key: 'trust-rights-security', glyph: 'trust', live: true, route: landingHref('/trust') },
          { key: 'api-catalogue-ingestion', glyph: 'code-brackets', live: true, route: landingHref('/developers') },
          { key: 'integration-planning', glyph: 'integration-planning', live: true, route: landingHref('/partners#contact'), status: 'scoping-available' },
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
          { key: 'developers-overview', glyph: 'code-brackets', live: true, route: landingHref('/developers') },
          { key: 'full-api-reference', glyph: 'api-reference', live: true, route: 'https://api-docs.resomix.com', external: true, externalAriaKey: 'fullApiReferenceAria' },
          { key: 'catalogue-ingestion', glyph: 'catalogue-ingestion', live: true, route: landingHref('/developers#dev-ingestion') },
          { key: 'track-analysis-schema', glyph: 'analysis-schema', live: true, route: landingHref('/developers#dev-schema') },
        ],
      },
      {
        groupLabelKey: 'evaluate',
        flex: '1 1 46%',
        items: [
          { key: 'request-api-access', glyph: 'request-api', live: true, route: landingHref('/partners/pilot') },
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
  // Home first: from the beta app there is otherwise no way back to the marketing site, and it
  // reads as the natural top of this list. `landingHref('/')` is resomix.com.
  { key: 'home', route: landingHref('/') },
  { key: 'about', route: landingHref('/about') },
  { key: 'journal', route: 'https://resomix.com/blog', external: true, externalAriaKey: 'journalAria' },
  { key: 'help-centre', route: 'https://support.resomix.com', external: true, externalAriaKey: 'helpCentreAria' },
  { key: 'faq', route: 'https://support.resomix.com', external: true, externalAriaKey: 'faqAria' },
  { key: 'legal-documents', route: 'https://support.resomix.com/hc/categories/1/3/legal', external: true, externalAriaKey: 'legalDocumentsAria' },
  { key: 'trust', route: landingHref('/trust') },
  { key: 'cookie-settings', route: '', isCookieSettings: true },
];

export type NavSectionKey = NavTopGroup['key'];

/** Beta app routes do not map to landing nav sections — section highlight stays off. */
export function getNavSectionForPath(_pathname: string): NavSectionKey | null {
  return null;
}

export function isCurrentNavRoute(_pathname: string, _hash: string, _route?: string): boolean {
  return false;
}
