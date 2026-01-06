import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { UploadHero, UploadOne } from "@/sections/desktop/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { UploadLoader } from "@/components/index.ts";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore, useTrackSimilarity } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate, useLocation } from "react-router-dom";
import React from "react";

export function UploadPage() {
  const { showOverlay, response, error, setError } = useUploadStore();
  const { setPlaylistResponse, loadCachedResponse } = usePlaylistStore();
  const navigate = useNavigate();
  const location = useLocation();
  const processedId = React.useRef<string | null>(null);

  const { handleSelectTrack } = useTrackSimilarity();

  // Trigger similarity if id param present on first mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    // Prevent infinite loop by checking if we've already processed this ID
    if (id && processedId.current !== id) {
      processedId.current = id;

      // First check cache before making API call
      const cachedResponse = loadCachedResponse(id);
      if (cachedResponse) {
        // Found in cache, use cached data and navigate directly
        setPlaylistResponse(cachedResponse);
        const playlistId = cachedResponse.data?.playlist?.id || null;
        if (playlistId) {
          navigate(`/playlist?id=${playlistId}`);
        } else {
          navigate('/playlist');
        }
      } else {
        // Not in cache, make API call
        handleSelectTrack(id, true);
      }
    }
  }, [loadCachedResponse, setPlaylistResponse, navigate]);

  // Watch for API completion and route to playlist
  React.useEffect(() => {
    if (response && response.success) {
      setPlaylistResponse(response as any);

      const playlistId = (response as any).data?.playlist?.id || null;
      if (playlistId) {
        navigate(`/playlist?id=${playlistId}`);
      } else {
        navigate('/playlist');
      }
    }
  }, [response, setPlaylistResponse, navigate]);

  // Cleanup effect to reset upload store state when leaving the page
  // This avoids the "Back" button loop and ensures loader is closed
  React.useEffect(() => {
    return () => {
      useUploadStore.getState().reset();
    };
  }, []);

  return (
    // <div className="bg-[var(--color-noise-background)]">
    <div className="bg-[var(--color-secondary)]">
      {/* Static noise background */}
      {/* <StaticNoise color="#3a3a3b" opacity={0.5} zIndex={1} overscanVh={50} /> */}
      <StaticNoise />

      {/* Content layer */}
      <div
        style={{
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          maxWidth: '2560px',
          overflowX: "hidden"
        }}
      >
        <main>
          <SideLines>
            {/* Navbar */}
            <header>
              <Navbar
                logo={<a href={BASE_LANDING_URL} aria-label="Resomix home" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
                mode="upload"
                baseUrl={BASE_LANDING_URL}
                baseBetaUrl={BASE_BETA_URL}
                customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
                onProfileClick={() => navigate('/profile')}
                currentPath={location.pathname}
              />
            </header>

            <UploadHero />
            <UploadOne />
            <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
          </SideLines >
        </main>
      </div>

      {showOverlay && (
        <div className="fixed inset-0 z-[9999]">
          <UploadLoader />
        </div>
      )}

      {error && (
        <StatusMessage
          isOpen={true}
          status="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}
    </div>
  );
}
