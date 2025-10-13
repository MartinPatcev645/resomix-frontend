import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { useFirstVisit, useResponsive } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
// Lazy-load pages directly for proper code-splitting
const HomePage = lazy(() => import("@/pages/desktop/HomePage.tsx").then(m => ({ default: m.HomePage })));
const HomeMobile = lazy(() => import("@/pages/mobile/HomeMobile.tsx").then(m => ({ default: m.HomeMobile })));
const AboutPage = lazy(() => import("@/pages/desktop/AboutPage.tsx").then(m => ({ default: m.AboutPage })));
const AboutMobile = lazy(() => import("@/pages/mobile/AboutMobile.tsx").then(m => ({ default: m.AboutMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
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
          <Route path="/" element={<UsedHomePage />} />
          <Route path="/about" element={<UsedAboutPage />} />
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
