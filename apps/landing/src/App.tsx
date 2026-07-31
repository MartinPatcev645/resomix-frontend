import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useFirstVisit, useResponsive, useAuthInit, useSilktide } from "@resomix/hooks";
import { consentConfig } from './config/consentConfig.ts';
import { WelcomeMessage, FeedbackForm, SineWaves, GoogleOneTap } from "@resomix/ui";
import { useFeedbackStore, useAuthStore } from "@resomix/stores";
import { LandingLayout } from "@/components/index.ts";
import { AppBackground } from "@/components/Layout/AppBackground.tsx";
import { BetaAuthRedirect } from "@/components/BetaAuthRedirect.tsx";
// Lazy-load pages directly for proper code-splitting
const HomePage = lazy(() => import("@/pages/HomePage.tsx"));
const AboutPage = lazy(() => import("@/pages/desktop/AboutPage.tsx").then(m => ({ default: m.AboutPage })));
const AboutMobile = lazy(() => import("@/pages/mobile/AboutMobile.tsx").then(m => ({ default: m.AboutMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
const PartnersPage = lazy(() => import("@/pages/PartnersPage.tsx"));
const PricingPage = lazy(() => import("@/pages/PricingPage.tsx"));
const ProductPage = lazy(() => import("@/pages/ProductPage.tsx"));
const SonicDiscoveryPage = lazy(() => import("@/pages/SonicDiscoveryPage.tsx"));
const TrackIntelligencePage = lazy(() => import("@/pages/TrackIntelligencePage.tsx"));
const CatalogueIntelligencePage = lazy(() => import("@/pages/CatalogueIntelligencePage.tsx"));
const DevelopersPage = lazy(() => import("@/pages/DevelopersPage.tsx"));
const PartnersPilotPage = lazy(() => import("@/pages/PartnersPilotPage.tsx"));
const TrustPage = lazy(() => import("@/pages/TrustPage.tsx"));
const RecordLabelsPage = lazy(() => import("@/pages/RecordLabelsPage.tsx"));
const SyncAgenciesPage = lazy(() => import("@/pages/SyncAgenciesPage.tsx"));
const SubscribePage = lazy(() => import("@/pages/SubscribePage.tsx"));
// const TestPage = lazy(() => import("@/pages/TestPage.tsx"));
import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";

function UsedAboutPage() {
  const { isDesktop } = useResponsive();

  return (
    <>
      {isDesktop ? <AboutPage /> : <AboutMobile />}
    </>
  );
}


function App() {
  useSilktide(consentConfig);
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
      <GoogleOneTap
        clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
        disabled={isAuthenticated || onAuthRoute}
      />

      {showWelcome &&
        <WelcomeMessage
          onClose={dismiss}
          dropSvg={ReferenceSvg}
          matchSvg={MatchesSvg}
          discoverSvg={AnalysisSvg}
        />}

      {showFeedback && <FeedbackForm />}

      <Suspense fallback={null}>
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
            <Route path="/about" element={<UsedAboutPage />} />
            <Route path="/partners" element={<PartnersPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/product" element={<ProductPage />} />
            <Route path="/product/sonic-discovery" element={<SonicDiscoveryPage />} />
            <Route path="/product/track-intelligence" element={<TrackIntelligencePage />} />
            <Route path="/product/catalog-intelligence" element={<CatalogueIntelligencePage />} />
            <Route path="/product/catalogue-intelligence" element={<Navigate to="/product/catalog-intelligence" replace />} />
            <Route path="/developers" element={<DevelopersPage />} />
            <Route path="/partners/pilot" element={<PartnersPilotPage />} />
            <Route path="/trust" element={<TrustPage />} />
            <Route path="/solutions/record-labels" element={<RecordLabelsPage />} />
            <Route path="/solutions/sync-agencies" element={<SyncAgenciesPage />} />
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
    </>
  );
}

export default App;
