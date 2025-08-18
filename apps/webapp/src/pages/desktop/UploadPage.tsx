import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { UploadHero, UploadOne } from "@/sections/desktop/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { UploadLoader } from "@/components/index.ts";
import { StatusMessage } from "@resomix/ui";
import { useUploadStore } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate } from "react-router-dom";
import React from "react";
import { useTrackSimilarity } from "@resomix/hooks";

export function UploadPage() {
  const { showOverlay, response, setOverlay, error, setError } = useUploadStore();
  const { setPlaylistResponse } = usePlaylistStore();
  const navigate = useNavigate();

  const { handleSelectTrack } = useTrackSimilarity();

  // Trigger similarity if id param present on first mount
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      handleSelectTrack(id);
    }
  }, [handleSelectTrack]);

  // Watch for API completion and route to playlist
  React.useEffect(() => {
    if (response && response.success) {
      setPlaylistResponse(response as any);
      // Hide loader if it was shown
      setOverlay(false);
      const playlistId = (response as any).data?.playlist?.id || null;
      if (playlistId) {
        navigate(`/playlist?id=${playlistId}`);
      } else {
        navigate('/playlist');
      }
    }
  }, [response, setPlaylistResponse, navigate, setOverlay]);

  return (
    <div className="bg-[var(--color-secondary)]">
      {/* Static noise background */}
      <StaticNoise color="#313132" opacity={0.7} zIndex={1} overscanVh={50} />

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
        <SideLines>
          {/* Navbar */}
          <Navbar
            logo={<a href={BASE_BETA_URL} className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="upload"
            baseUrl={BASE_LANDING_URL}
            baseBetaUrl={BASE_BETA_URL}
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          />

          <UploadHero />
          <UploadOne />
          <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
        </SideLines >
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
