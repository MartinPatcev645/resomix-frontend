import { MobileNavbar, GlobalMobileFooter } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { LogoHeader, LogoRFooter, MenuIcon } from "@/components/index.ts";
import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour } from "@/sections/mobile/index.ts";

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

        {/* Four lines around hero section to maintain design consistency */}
        <div className="absolute left-0 top-[var(--px-35)] w-[var(--px-20)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-35)] w-[var(--px-20)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute left-0 top-[var(--px-716)] w-[var(--px-20)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-716)] w-[var(--px-20)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>

        {/* Main Content */}
        <div className="mx-[var(--px-20)] h-full min-h-screen pt-[var(--px-35)] relative z-20">
          {/* Vertical border overlay so borders sit above inner content */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
            <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
            <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
          </div>
          {/* Navbar & Hero Section */}
          <div className="border-t border-b border-dotted border-slate-200">
            <MobileNavbar
              logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
              menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
              customClass="flex justify-between items-center align-center z-50 relative"
            />
            <AboutHero />
          </div>

          <img src={AngleDown} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />

          {/* Section One */}
          <div className="relative z-20 mt-[var(--px-60)]">
            <AboutOne />
            <AboutTwo />
            <AboutThree />
            <AboutFour />
            <GlobalMobileFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} />
          </div>
        </div>
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
