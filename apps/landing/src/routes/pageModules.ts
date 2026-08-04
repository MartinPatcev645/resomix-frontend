/**
 * Route → the page module's source path, as the Vite manifest keys it.
 *
 * Build-time only; nothing in the browser reads this. Every page is code-split, so Vite gives each
 * one its own stylesheet and injects it when that route's JS loads. That was invisible while the
 * markup also arrived with the JS — but the markup is prerendered into the HTML now, so without
 * this the browser paints a page whose CSS has not loaded yet and restyles it a moment later.
 *
 * The prerender looks each route up here, finds its CSS in the manifest, and links it in that
 * route's <head>. `routeCss.spec.ts` fails if these keys drift from `PAGE_LOADERS`, or if a path
 * here has no stylesheet in the built output.
 *
 * Kept in its OWN file, deliberately: `vite.config.ssr.ts` imports it, and Vite bundles config
 * files without the app's path aliases — importing it from `pageLoaders.ts` drags in `@/i18n.ts`
 * and the config fails to load.
 */
export const PAGE_MODULES: Record<string, string> = {
  '/': 'src/pages/HomePage.tsx',
  '/about': 'src/pages/AboutPage.tsx',
  '/partners': 'src/pages/PartnersPage.tsx',
  '/partners/pilot': 'src/pages/PartnersPilotPage.tsx',
  '/product': 'src/pages/ProductPage.tsx',
  '/product/sonic-discovery': 'src/pages/SonicDiscoveryPage.tsx',
  '/product/track-intelligence': 'src/pages/TrackIntelligencePage.tsx',
  '/product/catalog-intelligence': 'src/pages/CatalogueIntelligencePage.tsx',
  '/developers': 'src/pages/DevelopersPage.tsx',
  '/trust': 'src/pages/TrustPage.tsx',
  '/solutions/record-labels': 'src/pages/RecordLabelsPage.tsx',
  '/solutions/music-publishers': 'src/pages/MusicPublishersPage.tsx',
  '/solutions/sync-agencies': 'src/pages/SyncAgenciesPage.tsx',
  '/solutions/music-libraries-sample-providers': 'src/pages/MusicLibrariesPage.tsx',
  '/solutions/djs': 'src/pages/DjsPage.tsx',
  '/solutions/music-curators': 'src/pages/MusicCuratorsPage.tsx',
  '/solutions/producers': 'src/pages/ProducersPage.tsx',
  '/subscribe': 'src/pages/SubscribePage.tsx',
  '/contact': 'src/pages/InfoPage.tsx',
  '/waitlist': 'src/pages/InfoPage.tsx',
  '/error': 'src/pages/InfoPage.tsx',
};
