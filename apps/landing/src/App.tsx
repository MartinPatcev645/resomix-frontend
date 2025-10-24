import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useFirstVisit, useResponsive, useAuthInit, useCrossTabAuth } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm, SineWaves, StaticNoise } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import { ProtectedRoute, OptionalAuthRoute } from "@/components/index.ts";
// Lazy-load pages directly for proper code-splitting
const HomePage = lazy(() => import("@/pages/desktop/HomePage.tsx").then(m => ({ default: m.HomePage })));
const HomeMobile = lazy(() => import("@/pages/mobile/HomeMobile.tsx").then(m => ({ default: m.HomeMobile })));
const AboutPage = lazy(() => import("@/pages/desktop/AboutPage.tsx").then(m => ({ default: m.AboutPage })));
const AboutMobile = lazy(() => import("@/pages/mobile/AboutMobile.tsx").then(m => ({ default: m.AboutMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
const AuthPage = lazy(() => import("@/pages/AuthPage.tsx"));
const TestPage = lazy(() => import("@/pages/TestPage.tsx"));
import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";

function UsedHomePage() {
  const { isDesktop } = useResponsive();

  return (
    <>
      {isDesktop ? <HomePage /> : <HomeMobile />}
    </>
  );
}

function UsedAboutPage() {
  const { isDesktop } = useResponsive();

  return (
    <>
      {isDesktop ? <AboutPage /> : <AboutMobile />}
    </>
  );
}


function App() {
  const { showWelcome, dismiss } = useFirstVisit();
  const { showFeedback } = useFeedbackStore();
  const { isDesktop } = useResponsive();
  
  // Initialize authentication
  const { isInitialized, isLoading } = useAuthInit();
  useCrossTabAuth();

  // Show loading during auth initialization
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
          {/* Public Auth Routes */}
          <Route path="/auth/login" element={<AuthPage mode="login" />} />
          <Route path="/auth/register" element={<AuthPage mode="register" />} />
          <Route path="/auth/forgot-password" element={<AuthPage mode="forgot-password" />} />
          <Route path="/auth/reset-password" element={<AuthPage mode="reset-password" />} />
          <Route path="/auth/verify-email" element={<AuthPage mode="verify-email" />} />
          <Route path="/auth/verify-2fa" element={<AuthPage mode="verify-2fa" />} />

          {/* Protected Auth Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<AuthPage mode="profile" />} />
            <Route path="/sessions" element={<AuthPage mode="sessions" />} />
            <Route path="/change-password" element={<AuthPage mode="change-password" />} />
          </Route>

          {/* Optional Auth Routes (work with or without login) */}
          <Route path="/" element={<OptionalAuthRoute><UsedHomePage /></OptionalAuthRoute>} />
          <Route path="/about" element={<OptionalAuthRoute><UsedAboutPage /></OptionalAuthRoute>} />

          {/* Info Pages */}
          <Route path="/terms" element={<InfoPage mode="terms" />} />
          <Route path="/privacy" element={<InfoPage mode="privacy" />} />
          <Route path="/contact" element={<InfoPage mode="contact" />} />
          <Route path="/waitlist" element={<InfoPage mode="waitlist" />} />
          <Route path="/error" element={<InfoPage mode="error" />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="*" element={<InfoPage mode="404" />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
