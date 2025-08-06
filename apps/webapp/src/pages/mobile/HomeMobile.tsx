import { MobileNavbar, StaticNoise } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import { LogoHeader, MenuIcon } from "@/components/index.ts";

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
          maxWidth: "1023px",
        }}
      >
        {/* Mobile Navbar */}
        <MobileNavbar
          logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
          menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
        />

        {/* Main Content */}
        <div className="min-h-screen flex flex-col items-center justify-center px-6">
          <h1 className="text-4xl font-bold font-helvetica mb-6 text-center">
            Webapp Mobile
          </h1>
          <p className="text-lg font-helvetica text-center max-w-lg mb-6">
            Mobile version of the webapp with responsive design and menu functionality.
          </p>
          <div className="bg-white/10 p-6 rounded-lg backdrop-blur-sm w-full max-w-sm">
            <h2 className="text-xl font-helvetica mb-3">Mobile Features:</h2>
            <ul className="space-y-1 font-helvetica text-sm">
              <li>✓ Mobile navbar</li>
              <li>✓ Responsive typography</li>
              <li>✓ Touch-friendly interface</li>
              <li>✓ Mobile menu overlay</li>
              <li>✓ Optimized layouts</li>
            </ul>
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="mt-6 px-6 py-3 bg-white/20 hover:bg-white/30 rounded font-helvetica transition-colors"
          >
            Open Menu
          </button>
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