import { MobileNavbar } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import AngleDown from "@/assets/icons/AngleDown.svg";
import { LogoHeader, MenuIcon } from "@/components/index.ts";
import { UploadOne, UploadHero, UploadFooter } from "@/sections/mobile/index.ts";

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
          backgroundColor: "var(--color-primary-background)"
        }}
      >
        {/* Main Content */}
        <div className="mx-[var(--px-20)] border-l border-r h-full min-h-screen border-dotted border-slate-200 pt-[var(--px-35)] relative">
          {/* Navbar & Hero Section */}
          <div className="border-t border-b border-dotted border-slate-200">
            <MobileNavbar
              logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
              menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
              customClass="flex justify-between items-center align-center z-50 relative"
            />
            <UploadHero />
          </div>

          <img src={AngleDown} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] w-full self-center my-[var(--px-50)]" />

          {/* Section One */}
          <div className="relative z-20 mt-[var(--px-60)]">
            <UploadOne />
            <UploadFooter />
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
