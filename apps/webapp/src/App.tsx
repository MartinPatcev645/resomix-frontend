import { Routes, Route } from "react-router-dom";
import { useFirstVisit, useResponsive, useTermsAcceptance } from "@resomix/hooks";
import { WelcomeMessage, FeedbackForm, TermsAcceptance } from "@resomix/ui";
import { useFeedbackStore } from "@resomix/stores";
import { UploadPage, UploadMobile, PlaylistPage, PlaylistMobile, InfoPage, TestPage, TestTwo, PlayerPage } from "@/pages/index.ts";
import { UploadLoader } from "@/components/index.ts";
import ReferenceSvg from "@/assets/icons/reference.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";

// import DevMobileConsole from "@/DevMobileConsole.tsx";

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
  
  return (
    <>
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
        <Route path="*" element={<InfoPage mode="404" />} />
      </Routes>
    </>
  );
}

export default App;
