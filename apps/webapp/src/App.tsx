import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useFirstVisit, useResponsive, useTermsAcceptance, useAuthInit, useCrossTabAuth } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm, TermsAcceptance, SineWaves, StaticNoise } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import { ProtectedRoute, GuestRoute, WebLayout } from "@/components/index.ts";
import { MetricsOverlay } from "@/components/metrics/MetricsOverlay.js";

// Lazy-load pages
const UploadPage = lazy(() => import("@/pages/desktop/UploadPage.tsx").then(m => ({ default: m.UploadPage })));
const UploadMobile = lazy(() => import("@/pages/mobile/UploadMobile.tsx").then(m => ({ default: m.UploadMobile })));
const PlaylistPage = lazy(() => import("@/pages/desktop/PlaylistPage.tsx").then(m => ({ default: m.PlaylistPage })));
const PlaylistMobile = lazy(() => import("@/pages/mobile/PlaylistMobile.tsx").then(m => ({ default: m.PlaylistMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
const AuthPage = lazy(() => import("@/pages/AuthPage.tsx"));
const TestPage = lazy(() => import("@/pages/TestPage.tsx"));
const TestTwo = lazy(() => import("@/pages/TestTwo.tsx"));
const PlayerPage = lazy(() => import("@/pages/PlayerPage.tsx"));
const UploadLoader = lazy(() => import("@/components/index.ts").then(m => ({ default: m.UploadLoader })));
const AppleRedirect = lazy(() => import("@/pages/redirect/AppleRedirect.tsx").then(m => ({ default: m.AppleRedirect })));
const TidalRedirect = lazy(() => import("@/pages/redirect/TidalRedirect.tsx").then(m => ({ default: m.TidalRedirect })));
const SpotifyRedirect = lazy(() => import("@/pages/redirect/SpotifyRedirect.tsx").then(m => ({ default: m.SpotifyRedirect })));

import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";


function UploadLanding() {
  const { isDesktop } = useResponsive();
  return (
    <>
      {isDesktop ? <UploadPage /> : <UploadMobile />}
    </>
  );
}

function PlaylistLanding() {
  const { isDesktop } = useResponsive();
  return (
    <>
      {isDesktop ? <PlaylistPage /> : <PlaylistMobile />}
    </>
  );
}



function App() {
  const { showWelcome, dismiss } = useFirstVisit();
  const { showFeedback } = useFeedbackStore();
  const { showTerms, acceptTerms, dismissTerms } = useTermsAcceptance();
  const { isDesktop } = useResponsive();

  // Initialize authentication
  const { isInitialized, isLoading } = useAuthInit();
  useCrossTabAuth();

  const location = useLocation();
  const showMetrics = new URLSearchParams(location.search).get("metrics") === "true";

  // Show loading during auth initialization (prevent flash)
  if (isLoading || !isInitialized) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-secondary, #fff)',
        overflow: 'hidden'
      }}>
        {isDesktop && <StaticNoise />}
        <div style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '300px',
          padding: '20px'
        }}>
          <SineWaves />
        </div>
      </div>
    );
  }

  return (
    <>
      {showMetrics && <MetricsOverlay />}

      {/* <DevMobileConsole /> */}
      {showWelcome &&
        <WelcomeMessage
          onClose={dismiss}
          dropSvg={ReferenceSvg}
          matchSvg={MatchesSvg}
          discoverSvg={AnalysisSvg}
        />}

      {showFeedback && <FeedbackForm />}

      {showTerms && <TermsAcceptance onAccept={acceptTerms} onDismiss={dismissTerms} />}

      <Suspense fallback={null}>
        <Routes>
          {/* Group A: Routes wrapped in persistent WebLayout shell */}
          <Route element={<WebLayout />}>
            {/* Optional Auth Routes (work with or without login) */}
            <Route path="/" element={<UploadLanding />} />
            <Route path="/playlist" element={<PlaylistLanding />} />
            <Route path="/sonic-discovery" element={<PlaylistLanding />} />

            {/* Protected Auth Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<AuthPage mode="profile" />} />
              <Route path="/sessions" element={<AuthPage mode="sessions" />} />
              <Route path="/change-password" element={<AuthPage mode="change-password" />} />
            </Route>

            {/* Guest-Only Auth Routes */}
            <Route path="/auth/login" element={<GuestRoute><AuthPage mode="login" /></GuestRoute>} />
            <Route path="/auth/register" element={<GuestRoute><AuthPage mode="register" /></GuestRoute>} />
            <Route path="/auth/forgot-password" element={<GuestRoute><AuthPage mode="forgot-password" /></GuestRoute>} />

            {/* Other Auth Routes */}
            <Route path="/auth/reset-password" element={<AuthPage mode="reset-password" />} />
            <Route path="/auth/verify-email" element={<AuthPage mode="verify-email" />} />
            <Route path="/auth/verify-2fa" element={<AuthPage mode="verify-2fa" />} />

            {/* Info Pages */}
            <Route path="/contact" element={<InfoPage mode="contact" />} />
            <Route path="/error" element={<InfoPage mode="error" />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/test-two" element={<TestTwo />} />
            <Route path="*" element={<InfoPage mode="404" />} />
          </Route>

          {/* Group B: Standalone Routes (Outside the shell) */}
          <Route path="/loader" element={<UploadLoader />} />
          <Route path="/player" element={<PlayerPage />} />

          {/* Exports redirects */}
          <Route path="/apple-redirect" element={<AppleRedirect />} />
          <Route path="/tidal-redirect" element={<TidalRedirect />} />
          <Route path="/spotify-redirect" element={<SpotifyRedirect />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
