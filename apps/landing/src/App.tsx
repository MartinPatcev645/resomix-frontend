import { useResponsive } from "@resomix/hooks";
import { HomePage } from "./pages/desktop/HomePage.tsx";
import { HomeMobile } from "./pages/mobile/HomeMobile.tsx";
import { Routes, Route } from "react-router-dom";
import { AboutPage } from "./pages/desktop/AboutPage.tsx";
import { TermsPage } from "./pages/TermsPage.tsx";
import TestPage from "./pages/TestPage.tsx";

function LandingPage() {
  const { isDesktop } = useResponsive();

  return (
    <div className="bg-[var(--color-secondary)]">
      {isDesktop ? <HomePage /> : <HomeMobile />}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/test" element={<TestPage />} />
    </Routes>
  );
}

export default App;

