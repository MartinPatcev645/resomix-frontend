import { MobileNavbar, StaticNoise } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree } from "../../mobile_sections/index.ts";
import { LogoHeader } from "../../components/LogoHeader.tsx";
import { MenuIcon } from "../../components/MenuIcon.tsx";
// import mobileSideFrameSvg from "../../assets/icons/layout/mobile_side_frame_flexible.svg";
import mobileSideFrameSvg from "../../assets/icons/layout/mobile_full_side_frame.svg";

export function HomeMobile() {
  return (
    <>
      {/* Global Static Noise - covers entire viewport */}
      <StaticNoise color="#323233" zIndex={1} />

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
        <div className="absolute top-0 left-0 w-full max-w-full max-h-full pointer-events-none z-30" aria-hidden="true">
          <img src={mobileSideFrameSvg} alt="Side Frame" className="w-full h-auto" />
        </div>
        {/* Navbar */}
        <MobileNavbar
          logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
          menuIcon={<a href="/menu" className="cursor-default"><MenuIcon className="w-[var(--px-21)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
        />

        {/* Content Layer Sections */}
        <HeroSection />
        <SectionOne />
        <SectionTwo />
        <SectionThree />
      </div>
    </>
  );
}
