import { MobileNavbar, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { useState } from "react";
import { MenuPage } from "../index.ts";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { UploadOne, UploadHero } from "@/sections/mobile/index.ts";
import { BASE_LANDING_URL } from "@resomix/config";
import { UploadLoader } from "@/components/index.ts";
import { useUploadStore } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { useNavigate } from "react-router-dom";
import React from "react";

export function UploadMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { showOverlay, response, setOverlay } = useUploadStore();
  const { setPlaylistResponse } = usePlaylistStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (response && response.success) {
      setPlaylistResponse(response as any);
      setOverlay(false);
      navigate('/playlist');
    }
  }, [response, setPlaylistResponse, navigate, setOverlay]);

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
          hero={<UploadHero />}
          mode="upload"
        >
          <img src={AngleDown} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />

          {/* Section One */}
          <div className="relative z-20 mt-[var(--px-60)]">
            <UploadOne />
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

      {showOverlay && (
        <div className="fixed inset-0 z-[9999]">
          <UploadLoader />
        </div>
      )}
    </>
  );
}
