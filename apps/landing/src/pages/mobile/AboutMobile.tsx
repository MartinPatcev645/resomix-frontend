import { MobileNavbar, GlobalMobileFooter, SideLines } from "@resomix/ui";
import { useState } from "react";
import { MenuPage } from "../index.ts";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour } from "@/sections/mobile/index.ts";
import { BASE_LANDING_URL } from "@resomix/config";

export function AboutMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
          backgroundColor: "var(--color-primary-background)",
          overflowX: "hidden"
        }}
      >

        <SideLines
          navbar={
            <MobileNavbar
              logo={<a href="/" aria-label="Resomix home" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
              menuIcon={<button onClick={() => setIsMenuOpen(true)} aria-label="Open menu" className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
              customClass="flex justify-between items-center align-center z-50 relative"
            />
          }
          hero={<AboutHero />}
          mode="about"
        >
          
          <img src={AngleDown} draggable={false} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />

          {/* Section One */}
          <div className="relative z-20 mt-[var(--px-60)]">
            <AboutOne />
            <AboutTwo />
            <AboutThree />
            <AboutFour />
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
    </>
  );
}
