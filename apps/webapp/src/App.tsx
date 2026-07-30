import { lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";
import { useFirstVisit, useResponsive, useTermsAcceptance, useAuthInit, useSilktide, useTelemetry } from "@resomix/hooks";
import { consentConfig } from './config/consentConfig.ts';
import { WelcomeMessage, FeedbackForm, TermsAcceptance, SineWaves, GoogleOneTap } from "@resomix/ui";
import { useFeedbackStore, useAuthStore } from "@resomix/stores";
import { ProtectedRoute, GuestRoute, WebLayout, SessionExpiredModal, RouteFallback } from "@/components/index.ts";
import { AppBackground } from "@/components/Layout/AppBackground.tsx";
import { MetricsOverlay } from "@/components/metrics/MetricsOverlay.js";

// Lazy-load pages
const WorkspacePage = lazy(() => import("@/pages/desktop/WorkspacePage.tsx").then(m => ({ default: m.WorkspacePage })));
const WorkspaceMobile = lazy(() => import("@/pages/mobile/WorkspaceMobile.tsx").then(m => ({ default: m.WorkspaceMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
const AuthPage = lazy(() => import("@/pages/AuthPage.tsx"));
const SubscribePage = lazy(() => import("@/pages/SubscribePage.tsx"));
const UiSystemSpecimenPage = lazy(() => import("@/pages/UiSystemSpecimenPage.tsx"));
// const TestPage = lazy(() => import("@/pages/TestPage.tsx"));
// const TestTwo = lazy(() => import("@/pages/TestTwo.tsx"));
// const PlayerPage = lazy(() => import("@/pages/PlayerPage.tsx"));
const UploadLoader = lazy(() => import("@/components/index.ts").then(m => ({ default: m.UploadLoader })));
const LibraryPage = lazy(() => import("@/pages/LibraryPage.tsx"));
// Apple Music connects IN-PAGE via MusicKit (no app-owned redirect page needed — that pattern is
// only required for Spotify's server-side OAuth redirect flow).
// const TidalRedirect = lazy(() => import("@/pages/redirect/TidalRedirect.tsx").then(m => ({ default: m.TidalRedirect })));
// const SpotifyRedirect = lazy(() => import("@/pages/redirect/SpotifyRedirect.tsx").then(m => ({ default: m.SpotifyRedirect })));

import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";


function DiscoveryLanding() {
  const { isDesktop } = useResponsive();
  return isDesktop ? <WorkspacePage mode="discovery" /> : <WorkspaceMobile mode="discovery" />;
}

function AnalysisLanding() {
  const { isDesktop } = useResponsive();
  return isDesktop ? <WorkspacePage mode="analysis" /> : <WorkspaceMobile mode="analysis" />;
}

function HomeLanding() {
  const location = useLocation();
  return <Navigate to={`/sonic-discovery${location.search}${location.hash}`} replace state={location.state} />;
}

// /playlist is the legacy alias, kept as a redirect (never removed) so previously-shared links
// keep working. Canonical is /sonic-discovery; forward the query (?id=…), hash, and router state.
function PlaylistRedirect() {
  const location = useLocation();
  return <Navigate to={`/sonic-discovery${location.search}${location.hash}`} replace state={location.state} />;
}



function App() {
  useSilktide(consentConfig);
  useTelemetry();
  const { showWelcome, dismiss } = useFirstVisit();
  const { showFeedback } = useFeedbackStore();
  const { showTerms, acceptTerms, dismissTerms } = useTermsAcceptance();

  // Initialize authentication
  const { isInitialized, isLoading } = useAuthInit();


  const location = useLocation();
  const showMetrics = new URLSearchParams(location.search).get("metrics") === "true";
  // Google One Tap: only prompt logged-out visitors, and never on the /auth page (the full button
  // lives there — running both would clash over the single GIS config).
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const onAuthRoute = location.pathname.startsWith("/auth");

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
        {/* Same backdrop as every other surface — this used to be NebulaField, which is why a
            hard refresh flashed the old aurora/stars background before the shell mounted. */}
        <AppBackground />
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
      <GoogleOneTap
        clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}
        disabled={isAuthenticated || onAuthRoute}
      />

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

      {/* Server-invalidated session → "log in again" modal. Mounted once, covers every route
          (desktop + mobile); raised in every tab via the reason-carrying logout broadcast. */}
      <SessionExpiredModal />

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Group A: Routes wrapped in persistent WebLayout shell */}
          <Route element={<WebLayout />}>
            {/* Optional Auth Routes (work with or without login) */}
            <Route path="/" element={<HomeLanding />} />
            {/* Canonical discovery workspace + playlist results (?id=). /playlist redirects here (back-compat). */}
            {/* NOTE: no OptionalAuthRoute here — WebLayout already wraps its whole subtree in one,
                so every route in this group gets the beta/verification banners. Wrapping again
                rendered the beta notice twice (once above the navbar, once inside <main>). */}
            <Route path="/sonic-discovery" element={<DiscoveryLanding />} />
            <Route path="/playlist" element={<PlaylistRedirect />} />
            <Route path="/analysis" element={<AnalysisLanding />} />
            <Route path="/subscribe" element={<SubscribePage />} />
            {import.meta.env.DEV ? <Route path="/__ui-system" element={<UiSystemSpecimenPage />} /> : null}

            {/* Protected Auth Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<AuthPage mode="profile" />} />
              <Route path="/sessions" element={<AuthPage mode="sessions" />} />
              <Route path="/change-password" element={<AuthPage mode="change-password" />} />
              <Route path="/library" element={<LibraryPage />} />
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
            <Route path="*" element={<InfoPage mode="404" />} />
          </Route>

          {/* Group B: Standalone Routes (Outside the shell) */}
          <Route path="/loader" element={<UploadLoader />} />

          {/* Exports redirects */}
          {/* <Route path="/tidal-redirect" element={<TidalRedirect />} />
          <Route path="/spotify-redirect" element={<SpotifyRedirect />} /> */}
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
