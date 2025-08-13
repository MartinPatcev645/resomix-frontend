import { MobileNavbar, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { PlaylistHero, PlaylistTable } from "@/sections/mobile/index.ts";
import MoreMenu from "@/sections/mobile/Playlist/MoreMenu.tsx";

export function PlaylistMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const handleMoreMenuOpen = (trackId: string) => {
    setSelectedTrackId(trackId);
    setShowMoreMenu(true);
  };

  const handleMoreMenuClose = () => {
    setShowMoreMenu(false);
    setSelectedTrackId(null);
  };

  return (
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
              logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
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
            <GlobalMobileFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} />
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
          <MoreMenu onClose={handleMoreMenuClose} trackId={selectedTrackId || undefined} />
        </div>
      )}
    </>
  );
}
