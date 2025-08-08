import { MobileNavbar } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import { HomeHero, HomeOne, HomeTwo, HomeThree, HomeFour, HomeFive, HomeSix, HomeSeven, HomeEight, HomeNine, HomeFooter } from "@/sections/mobile/index.ts";
import { LogoHeader, MenuIcon } from "@/components/index.ts";

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
        }}
      >
        <div className="mx-[var(--px-20)] border border-dotted border-slate-200">
          {/* Navbar */}
          <MobileNavbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
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
          <HomeFooter />
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
