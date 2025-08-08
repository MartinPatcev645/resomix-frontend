import { useResponsive } from "@resomix/hooks";
import { HomePage } from "./pages/desktop/HomePage.tsx";
import { HomeMobile } from "./pages/mobile/HomeMobile.tsx";
import { Routes, Route } from "react-router-dom";

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
    </Routes>
  );
}

export default App;
