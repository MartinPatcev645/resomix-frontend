import { MobileNavbar, GlobalMobileFooter } from "@resomix/ui";
import { useState } from "react";
import { MenuPage } from "../index.ts";
import { HomeHero, HomeOne, HomeTwo, HomeThree, HomeFour, HomeFive, HomeSix, HomeSeven, HomeEight, HomeNine } from "@/sections/mobile/index.ts";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { BASE_LANDING_URL } from "@resomix/config";

export function HomeMobile() {
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
          backgroundColor: 'var(--color-primary-background)'
        }}
      >
        <div className="absolute inset-0 w-full mt-[var(--px-23)] border-t border-slate-200 border-dotted pointer-events-none z-10">
        </div>
        <div className="mx-[var(--px-19)] border-l border-r border-dotted border-slate-200">
          {/* Navbar */}
          <MobileNavbar
            logo={<a href={BASE_LANDING_URL} aria-label="Resomix home" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            menuIcon={<button onClick={() => setIsMenuOpen(true)} aria-label="Open menu" className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
          />

          {/* Content Layer Sections */}
          <HomeHero />
          <HomeOne />
          <HomeTwo />
          <HomeThree />
          <HomeFour />
          <HomeFive />
          <HomeSix />
          <HomeSeven />
          <HomeEight />
          <HomeNine />
          <GlobalMobileFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
        </div>
      </div>
      {isMenuOpen && (
        <div className="fixed inset-0 z-[100]">
          <MenuPage onClose={() => setIsMenuOpen(false)} />
        </div>
      )}
    </>
  );
}
