import { MobileNavbar, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { useState, useEffect } from "react";
import { MenuPage } from "../index.ts";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";
import { BASE_LANDING_URL, BASE_BETA_URL } from "@resomix/config";
import { usePlaylistStore } from "@resomix/stores";
import { AudioProvider, usePlaylistLoader } from "@resomix/hooks";
import { StatusMessage } from "@resomix/ui";

export function PlaylistMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<{ id: string; name: string; label: string; duration: number; score?: number | null; isInput: boolean } | null>(null);

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

  const handleMoreMenuOpen = (
    trackId: string,
    name: string,
    label: string,
    duration: number,
    score: number | null,
    isInput: boolean = false,
  ) => {
    setSelectedTrack({ id: trackId, name, label, duration, score, isInput });
    setShowMoreMenu(true);
  };

  const handleMoreMenuClose = () => {
    setShowMoreMenu(false);
    setSelectedTrack(null);
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
        <>
          {/* Content layer */}
          <div
            style={{
              margin: "0 auto",
              color: "var(--color-text-secondary)",
              position: "relative",
              zIndex: 30,
              maxWidth: "1023px",
              backgroundColor: 'var(--color-primary-background)',
              overflowX: "hidden"
            }}
          >

            <SideLines
              navbar={
                <MobileNavbar
                  logo={<a href={BASE_LANDING_URL} className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
                  menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
                  customClass="flex justify-between items-center align-center z-50 relative"
                />
              }
              hero={<PlaylistHero onMoreClick={handleMoreMenuOpen} />}
              mode="playlist"
            >
              {/* Content Table */}
              <div className="relative z-20">
                <PlaylistTable onMoreClick={handleMoreMenuOpen} />
                <GlobalMobileFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
              </div>
            </SideLines>

          </div>

          {/* Menu Overlay */}
          {isMenuOpen && (
            <div className="fixed inset-0 z-[100]">
              <MenuPage onClose={() => setIsMenuOpen(false)} />
            </div>
          )}

          {/* More Menu Overlay */}
          {showMoreMenu && (
            <div className="fixed inset-0 z-[100]">
              <MoreMenu
                onClose={handleMoreMenuClose}
                trackId={selectedTrack?.id}
                name={selectedTrack?.name}
                label={selectedTrack?.label}
                duration={selectedTrack?.duration}
                score={selectedTrack?.score ?? undefined}
                isInput={selectedTrack?.isInput || false}
              />
            </div>
          )}
        </>
      )}
    </AudioProvider>
  );
}
