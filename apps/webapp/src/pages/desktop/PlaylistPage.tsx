import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { useEffect, useState } from "react";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { PlaylistHero, PlaylistTable } from "@/sections/desktop/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { usePlaylistStore } from "@resomix/stores";
import { StatusMessage } from "@resomix/ui";

export function PlaylistPage() {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { playlistData, isLoading } = usePlaylistStore();
  const [expired, setExpired] = useState(false);

  // Load from ?id= if store empty
  usePlaylistLoader();

  // Handle expired fallback
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (!isLoading && !playlistData) {
      setExpired(true);
      timeoutId = setTimeout(() => {
        handleExpiredClose();
      }, 3000);
    } else {
      // Data arrived or still loading – ensure expired flag reset
      setExpired(false);
      if (timeoutId) clearTimeout(timeoutId);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoading, playlistData]);

  const handleExpiredClose = () => {
    window.location.href = BASE_BETA_URL;
  };

  return (
    <AudioProvider>
      {isLoading ? (
        <StatusMessage
          isOpen={true}
          status="loading"
          message="Loading playlist..."
          onClose={() => { }}
        />
      ) : expired ? (
        <StatusMessage
          isOpen={true}
          onClose={handleExpiredClose}
          status="error"
          message="Playlist expired. Redirecting..."
        />
      ) : (
        <div className="bg-[var(--color-secondary)]">
          {/* Static noise background */}
          <StaticNoise color="#313132" opacity={0.7} zIndex={10} overscanVh={50} />

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
                mode="playlist"
                baseUrl={BASE_LANDING_URL}
                baseBetaUrl={BASE_BETA_URL}
                customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
              />

              <PlaylistHero />
              <PlaylistTable />
              <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
            </SideLines>
          </div>
        </div>
      )}
    </AudioProvider>
  );
}
