import { useResponsive } from "@resomix/hooks";
import {
  HomePage,
  HomeMobile,
  AboutPage,
  AboutMobile,
  TermsPage,
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
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/test" element={<TestPage />} />
    </Routes>
  );
}

export default App;

