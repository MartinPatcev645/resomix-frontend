import { useResponsive } from "@resomix/hooks";
import { UploadPage, UploadMobile, PlaylistPage, PlaylistMobile } from "./pages/index.ts";
import { Routes, Route } from "react-router-dom";

function UploadLanding() {
  const { isDesktop } = useResponsive();
  return (
    <div>
      {isDesktop ? <UploadPage /> : <UploadMobile />}
    </div>
  );
}

function PlaylistLanding() {
  const { isDesktop } = useResponsive();
  return (
    <div>
      {isDesktop ? <PlaylistPage /> : <PlaylistMobile />}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadLanding />} />
      <Route path="/playlist" element={<PlaylistLanding />} />
    </Routes>
  );
}

export default App;
