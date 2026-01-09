import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useFirstVisit, useResponsive, useAuthInit, useCrossTabAuth } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm, SineWaves } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import { ProtectedRoute, GuestRoute, LandingLayout } from "@/components/index.ts";
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
  // Initialize authentication
  const { isInitialized, isLoading } = useAuthInit();
  useCrossTabAuth();

  // Show simple loading during auth initialization to avoid flashes
  if (isLoading || !isInitialized) {
    return (
      <div className="bg-[var(--color-secondary)] min-h-screen flex items-center justify-center">
        <div className="w-full max-w-[300px] p-5">
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
          <Route element={<LandingLayout />}>
            {/* Guest-Only Auth Routes */}
            <Route path="/auth/login" element={<GuestRoute><AuthPage mode="login" /></GuestRoute>} />
            <Route path="/auth/register" element={<GuestRoute><AuthPage mode="register" /></GuestRoute>} />
            <Route path="/auth/forgot-password" element={<GuestRoute><AuthPage mode="forgot-password" /></GuestRoute>} />

            {/* Auth Routes that work regardless of login state */}
            <Route path="/auth/reset-password" element={<AuthPage mode="reset-password" />} />
            <Route path="/auth/verify-email" element={<AuthPage mode="verify-email" />} />
            <Route path="/auth/verify-2fa" element={<AuthPage mode="verify-2fa" />} />

            {/* Protected Auth Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<AuthPage mode="profile" />} />
              <Route path="/sessions" element={<AuthPage mode="sessions" />} />
              <Route path="/change-password" element={<AuthPage mode="change-password" />} />
            </Route>

            {/* Optional Auth Routes */}
            <Route path="/" element={<UsedHomePage />} />
            <Route path="/about" element={<UsedAboutPage />} />

            {/* Info Pages */}
            <Route path="/terms" element={<InfoPage mode="terms" />} />
            <Route path="/privacy" element={<InfoPage mode="privacy" />} />
            <Route path="/contact" element={<InfoPage mode="contact" />} />
            <Route path="/waitlist" element={<InfoPage mode="waitlist" />} />
            <Route path="/error" element={<InfoPage mode="error" />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="*" element={<InfoPage mode="404" />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
