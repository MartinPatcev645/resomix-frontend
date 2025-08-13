import { useResponsive } from "@resomix/hooks";
import {
  HomePage,
  HomeMobile,
  AboutPage,
  AboutMobile,
  InfoPage,
  TestPage,
} from "./pages/index.ts";
import { Routes, Route } from "react-router-dom";

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
  return (
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
  );
}

export default App;

