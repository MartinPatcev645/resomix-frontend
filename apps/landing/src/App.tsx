import { useResponsive } from "@resomix/hooks";
import { DesktopLanding } from "./pages/DesktopLanding.tsx";
import { MobileLanding } from "./pages/MobileLanding.tsx";

function App() {
  const { isDesktop } = useResponsive();

  return (
    <div className="bg-black relative">
      {isDesktop ? <DesktopLanding /> : <MobileLanding />}
    </div>
  );
}

export default App;
