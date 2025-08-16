import { Routes, Route } from "react-router-dom";
import { useFirstVisit, useResponsive } from "@resomix/hooks";
import { WelcomeMessage } from "@resomix/ui";
import {
  HomePage,
  HomeMobile,
  AboutPage,
  AboutMobile,
  InfoPage,
  TestPage,
} from "@/pages/index.ts";
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

  return (
    <>
      {showWelcome &&
        <WelcomeMessage
          onClose={dismiss}
          dropSvg={ReferenceSvg}
          matchSvg={MatchesSvg}
          discoverSvg={AnalysisSvg}
        />}
      <Routes>
        <Route path="/" element={<UsedHomePage />} />
        <Route path="/about" element={<UsedAboutPage />} />
        <Route path="/terms" element={<InfoPage mode="terms" />} />
        <Route path="/privacy" element={<InfoPage mode="privacy" />} />
        <Route path="/contact" element={<InfoPage mode="contact" />} />
        <Route path="/error" element={<InfoPage mode="error" />} />
        <Route path="/test" element={<TestPage />} />
        <Route path="*" element={<InfoPage mode="404" />} />
      </Routes>
    </>
  );
}

export default App;

