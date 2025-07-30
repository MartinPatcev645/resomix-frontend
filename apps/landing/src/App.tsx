import { useResponsive } from "@resomix/hooks";
import { DesktopLanding } from "./pages/DesktopLanding.tsx";
import { MobileLanding } from "./pages/MobileLanding.tsx";
import { Routes, Route } from "react-router-dom";
import { Menu } from "./pages/MenuPage.tsx";
import { About } from "./pages/AboutPage.tsx";
import { Terms } from "./pages/TermsPage.tsx";

function LandingPage() {
  const { isDesktop } = useResponsive();

  return (
    <div className="bg-black relative">
      {isDesktop ? <DesktopLanding /> : <MobileLanding />}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/menu" element={<Menu />} />
      <Route path="/about" element={<About />} />
      <Route path="/terms" element={<Terms />} />
    </Routes>
  );
}

export default App;
