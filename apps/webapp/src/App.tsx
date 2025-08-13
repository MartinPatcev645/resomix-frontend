import { useResponsive } from "@resomix/hooks";
import { UploadPage, UploadMobile, PlaylistPage, PlaylistMobile, InfoPage } from "./pages/index.ts";
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
      <Route path="/contact" element={<InfoPage mode="contact" />} />
      <Route path="/error" element={<InfoPage mode="error" />} />
      <Route path="*" element={<InfoPage mode="404" />} />
    </Routes>
  );
}

export default App;
