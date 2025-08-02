import { useResponsive } from "@resomix/hooks";
import { DesktopLanding } from "./pages/DesktopLanding.tsx";
import { MobileLanding } from "./pages/MobileLanding.tsx";
import { Routes, Route } from "react-router-dom";
import MenuPage from "./pages/MenuPage.tsx";
import { AboutPage } from "./pages/AboutPage.tsx";
import { TermsPage } from "./pages/TermsPage.tsx";

function LandingPage() {
  const { isDesktop } = useResponsive();

  return (
    <div className="bg-[#323233]">
      {isDesktop ? <DesktopLanding /> : <MobileLanding />}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/menu" element={<MenuPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/terms" element={<TermsPage />} />
    </Routes>
  );
}

export default App;
