import { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useFirstVisit, useAuthInit, useSilktide, useAfterIdle, useGoogleTagManager } from "@resomix/hooks";
import { consentConfig } from './config/consentConfig.ts';
import { WelcomeMessage, FeedbackForm, SineWaves, GoogleOneTap } from "@resomix/ui";
import { useFeedbackStore, useAuthStore } from "@resomix/stores";
import { LandingLayout } from "@/components/index.ts";
import { AppBackground } from "@/components/Layout/AppBackground.tsx";
import { BetaAuthRedirect } from "@/components/BetaAuthRedirect.tsx";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary.tsx";
import { RouteMeta } from "@/components/RouteMeta.tsx";
import { RouteFallback } from "@/components/RouteFallback.tsx";
import { PAGE_LOADERS } from "@/routes/pageLoaders.ts";
import { lazyRoute } from "@/routes/lazyRoute.ts";

/* Pages are code-split. `lazyRoute` wraps React.lazy so a chunk that fails to download — the
   normal outcome for a tab that was open when a deploy shipped — retries and then recovers,
   instead of silently rendering nothing. The loaders live in PAGE_LOADERS so nav links can also
   prefetch them on hover; see routes/pageLoaders.ts. */
const HomePage = lazyRoute(PAGE_LOADERS['/']);
const AboutPage = lazyRoute(PAGE_LOADERS['/about']);
const InfoPage = lazyRoute(PAGE_LOADERS['/contact']);
const PartnersPage = lazyRoute(PAGE_LOADERS['/partners']);
const ProductPage = lazyRoute(PAGE_LOADERS['/product']);
const SonicDiscoveryPage = lazyRoute(PAGE_LOADERS['/product/sonic-discovery']);
const TrackIntelligencePage = lazyRoute(PAGE_LOADERS['/product/track-intelligence']);
const CatalogueIntelligencePage = lazyRoute(PAGE_LOADERS['/product/catalog-intelligence']);
const DevelopersPage = lazyRoute(PAGE_LOADERS['/developers']);
const PartnersPilotPage = lazyRoute(PAGE_LOADERS['/partners/pilot']);
const TrustPage = lazyRoute(PAGE_LOADERS['/trust']);
const RecordLabelsPage = lazyRoute(PAGE_LOADERS['/solutions/record-labels']);
const MusicPublishersPage = lazyRoute(PAGE_LOADERS['/solutions/music-publishers']);
const SyncAgenciesPage = lazyRoute(PAGE_LOADERS['/solutions/sync-agencies']);
const MusicLibrariesPage = lazyRoute(PAGE_LOADERS['/solutions/music-libraries-sample-providers']);
const DjsPage = lazyRoute(PAGE_LOADERS['/solutions/djs']);
const MusicCuratorsPage = lazyRoute(PAGE_LOADERS['/solutions/music-curators']);
const ProducersPage = lazyRoute(PAGE_LOADERS['/solutions/producers']);
const SubscribePage = lazyRoute(PAGE_LOADERS['/subscribe']);
import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";

function App() {
  /*
   * Silktide (the consent banner) loads EAGERLY and deliberately: it is functional, not analytics,
   * and Consent Mode needs it present before anything it gates.
   *
   * Everything below is staged so it cannot compete with first paint. Lighthouse measured 399 KiB
   * of third-party JS on this page — more than the app itself — and none of it renders content.
   *
   *   stage 1 (idle)          Google One Tap — user-facing, so it goes first
   *   stage 2 (idle + 1.5 s)  Google Tag Manager, which in turn loads PostHog
   *
   * Note the ordering constraint: PostHog is loaded BY the GTM container, not by this codebase, so
   * it can never start earlier than GTM. Putting GTM last therefore puts PostHog last too.
   */
  useSilktide(consentConfig);

  const oneTapReady = useAfterIdle(0);
  const analyticsReady = useAfterIdle(1500);
  useGoogleTagManager(import.meta.env.VITE_GTM_ID ?? 'GTM-PD9XQZRV', analyticsReady);
  const { showWelcome, dismiss } = useFirstVisit();
  const { showFeedback } = useFeedbackStore();
  // Initialize authentication
  const { isInitialized, isLoading } = useAuthInit();

  // Google One Tap: prompt logged-out visitors, but not on the /auth page (button lives there).
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onAuthRoute = location.pathname.startsWith("/auth");


  // Show simple loading during auth initialization to avoid flashes
  if (isLoading || !isInitialized) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[var(--color-secondary)]">
        {/* The boot screen carries the app backdrop too, so the first paint already looks like the
            product instead of a flat panel. */}
        <AppBackground />
        <div className="relative z-30 w-full max-w-[300px] p-5">
          <SineWaves />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mounted only once idle: the GIS client is 98 KiB and prompts a signed-out visitor, so it
          has no reason to load before the page they came for has painted. */}
      {oneTapReady && (
        <GoogleOneTap
          clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
          disabled={isAuthenticated || onAuthRoute}
        />
      )}

      {showWelcome &&
        <WelcomeMessage
          onClose={dismiss}
          dropSvg={ReferenceSvg}
          matchSvg={MatchesSvg}
          discoverSvg={AnalysisSvg}
        />}

      {showFeedback && <FeedbackForm />}

      {/* Title, description, canonical and social tags for the current route. Mounted once so
          no page has to remember to set them. */}
      <RouteMeta />

      {/* resetKey: an error on one route must not poison the next one the user picks. */}
      <RouteErrorBoundary resetKey={location.pathname}>
        {/* Not `null`. In-app navigation is wrapped in startTransition (LandingLayout), so React
            keeps the current page on screen while the next chunk downloads and this fallback never
            appears for those. It is for the cases with nothing to keep: a cold load or a direct
            deep link on a slow connection, which previously rendered a blank document. */}
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Auth and account screens are served ONLY by the web app. These forward to the same
              path on beta, carrying the query string — see BetaAuthRedirect for why that matters
              for emailed verify/reset links. The wildcard means a path we never listed (or one the
              backend adds later) still lands somewhere real instead of the 404.

              OUTSIDE LandingLayout on purpose: we are leaving the site, so painting the marketing
              nav and footer for one frame would just be a flash of the wrong thing.

              Deliberately NOT wrapped in GuestRoute/ProtectedRoute either — beta owns those
              decisions now, and a guard here would swallow the redirect for signed-in visitors. */}
          <Route path="/auth/*" element={<BetaAuthRedirect />} />
          <Route path="/profile" element={<BetaAuthRedirect />} />
          <Route path="/sessions" element={<BetaAuthRedirect />} />
          <Route path="/change-password" element={<BetaAuthRedirect />} />

          <Route element={<LandingLayout />}>
            {/* Optional Auth Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            {/* /pricing and /subscribe rendered the identical component. Consolidated onto
                /subscribe; this keeps existing links, bookmarks and search results working
                rather than 404ing them — same treatment as the catalogue-intelligence spelling
                redirect below. */}
            
            <Route path="/pricing" element={<Navigate to="/subscribe" replace />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/product/sonic-discovery" element={<SonicDiscoveryPage />} />
            <Route path="/product/track-intelligence" element={<TrackIntelligencePage />} />
            <Route path="/product/catalog-intelligence" element={<CatalogueIntelligencePage />} />
            <Route path="/product/catalogue-intelligence" element={<Navigate to="/product/catalog-intelligence" replace />} />
            <Route path="/developers" element={<DevelopersPage />} />
            <Route path="/partners/pilot" element={<PartnersPilotPage />} />
            <Route path="/trust" element={<TrustPage />} />
            <Route path="/solutions/record-labels" element={<RecordLabelsPage />} />
            <Route path="/solutions/music-publishers" element={<MusicPublishersPage />} />
            <Route path="/solutions/sync-agencies" element={<SyncAgenciesPage />} />
            <Route path="/solutions/music-libraries-sample-providers" element={<MusicLibrariesPage />} />
            <Route path="/solutions/djs" element={<DjsPage />} />
            <Route path="/solutions/music-curators" element={<MusicCuratorsPage />} />
            <Route path="/solutions/producers" element={<ProducersPage />} />
            <Route path="/subscribe" element={<SubscribePage />} />

            {/* Info Pages */}
            <Route path="/contact" element={<InfoPage mode="contact" />} />
            <Route path="/waitlist" element={<InfoPage mode="waitlist" />} />
            <Route path="/error" element={<InfoPage mode="error" />} />
            {/* <Route path="/test" element={<TestPage />} /> */}
            <Route path="*" element={<InfoPage mode="404" />} />
          </Route>
        </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </>
  );
}

export default App;
