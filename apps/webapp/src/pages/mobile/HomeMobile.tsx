import { MobileNavbar, StaticNoise } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import { LogoHeader, MenuIcon } from "@/components/index.ts";
import { UploadHero } from "@/sections/mobile/index.ts";

export function HomeMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      {/* Static noise background */}
      <StaticNoise color="#323233" opacity={0.7} zIndex={1} overscanVh={25} />

      {/* Content layer */}
      <div
        style={{
          margin: "0 auto",
          color: "var(--color-text-secondary)",
          position: "relative",
          zIndex: 30,
          maxWidth: "1023px"
        }}
      >
        {/* Main Content */}
        <div className="mx-[var(--px-20)] border-l border-r h-full min-h-screen border-dotted border-slate-200 bg-[var(--color-primary-background)] pt-[var(--px-35)] relative">
          {/* Navbar & Hero Section */}
          <div className="border-t border-b border-dotted border-slate-200">
            <MobileNavbar
              logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
              menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
              customClass="flex justify-between items-center align-center z-50 relative"
            />
            <UploadHero />
          </div>

          {/* Section One */}
          <div className="relative z-20 mt-[var(--px-60)]">
            TESTING
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