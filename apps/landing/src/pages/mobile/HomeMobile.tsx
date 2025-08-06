// import { MobileNavbar, StaticNoise } from "@resomix/ui";
import { MobileNavbar } from "@resomix/ui";
import { useState } from "react";
import MenuPage from "./MenuPage.tsx";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, SectionEight, SectionNine, FooterSection } from "../../mobile_sections/index.ts";
import { LogoHeader, MenuIcon } from "../../components/index.ts";
// import mobileSideFrameSvg from "../../assets/icons/layout/new_mobile_side_frame.svg";
// import mobileSideFrameSvg from "../../assets/icons/layout/mobile_full_side_frame.svg";

export function HomeMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <>
      {/* Static noise now overscans 25 vh above & below viewport to avoid flashes during fast scroll */}
      {/* <StaticNoise color="#323233" opacity={0.7} zIndex={1} overscanVh={25} /> */}

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
          {/* <div className="absolute top-0 left-0 w-full max-w-full max-h-full pointer-events-none z-30" aria-hidden="true">
          <img src={mobileSideFrameSvg} alt="Side Frame" className="w-full h-auto" />
        </div> */}
          {/* Navbar */}
          <MobileNavbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-120)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            menuIcon={<button onClick={() => setIsMenuOpen(true)} className="cursor-default"><MenuIcon className="w-[var(--px-25)] h-[var(--px-17)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></button>}
          />

          {/* Content Layer Sections */}
          <HeroSection />
          <SectionOne />
          <SectionTwo />
          <SectionThree />
          <SectionFour />
          <SectionFive />
          <SectionSix />
          <SectionSeven />
          <SectionEight />
          <SectionNine />
          <FooterSection />
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
