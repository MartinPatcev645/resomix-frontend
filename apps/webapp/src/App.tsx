import { useResponsive } from "@resomix/hooks";
import { UploadPage, UploadMobile, PlaylistPage, PlaylistMobile } from "./pages/index.ts";
import { Routes, Route } from "react-router-dom";

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
  return (
    <Routes>
      <Route path="/" element={<UploadLanding />} />
      <Route path="/playlist" element={<PlaylistLanding />} />
    </Routes>
  );
}

export default App;
