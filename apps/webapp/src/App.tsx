import { lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { useFirstVisit, useResponsive, useTermsAcceptance } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm, TermsAcceptance } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import {MetricsOverlay} from "@/components/metrics/MetricsOverlay.js";

// Lazy-load pages
const UploadPage = lazy(() => import("@/pages/desktop/UploadPage.tsx").then(m => ({ default: m.UploadPage })));
const UploadMobile = lazy(() => import("@/pages/mobile/UploadMobile.tsx").then(m => ({ default: m.UploadMobile })));
const PlaylistPage = lazy(() => import("@/pages/desktop/PlaylistPage.tsx").then(m => ({ default: m.PlaylistPage })));
const PlaylistMobile = lazy(() => import("@/pages/mobile/PlaylistMobile.tsx").then(m => ({ default: m.PlaylistMobile })));
const InfoPage = lazy(() => import("@/pages/InfoPage.tsx"));
const TestPage = lazy(() => import("@/pages/TestPage.tsx"));
const TestTwo = lazy(() => import("@/pages/TestTwo.tsx"));
const PlayerPage = lazy(() => import("@/pages/PlayerPage.tsx"));
const UploadLoader = lazy(() => import("@/components/index.ts").then(m => ({ default: m.UploadLoader })));
const SpotifyRedirect = lazy(()=>import("@/pages/redirect/SpotifyRedirect.tsx").then(m => ({ default: m.SpotifyRedirect })));
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

  const location = useLocation();
  const showMetrics = new URLSearchParams(location.search).get("metrics") === "true";

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
          <Route path="/" element={<UploadLanding />} />
          <Route path="/loader" element={<UploadLoader />} />
          <Route path="/playlist" element={<PlaylistLanding />} />
          <Route path="/sonic-discovery" element={<PlaylistLanding />} />
          <Route path="/contact" element={<InfoPage mode="contact" />} />
          <Route path="/error" element={<InfoPage mode="error" />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/test-two" element={<TestTwo />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route path="/spotify-redirect" element={<SpotifyRedirect />} />
          <Route path="*" element={<InfoPage mode="404" />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
