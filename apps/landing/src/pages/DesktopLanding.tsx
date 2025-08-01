import { Navbar } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, SectionEight, SectionNine, FooterSection } from "../sections/index.ts";
import { BackgroundNoise } from "../components/index.ts";
import sideFrameSvg from "../assets/icons/layout/side_frame.svg";
import { LogoHeader } from "../components/LogoHeader.tsx";

export function DesktopLanding() {
  return (
    <>
      {/* Global Background Noise - covers entire viewport */}
      <BackgroundNoise zIndex={1} />

      {/* Content layer */}
      <div
        style={{
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          maxWidth: '2560px',
        }} className="bg-[var(--color-secondary)]"
      >
        {/* 242422 */}

        {/* SVG Overlay inside 1280px content */}
        <div
          className="absolute top-0 max-w-full max-h-full pointer-events-none z-30"
          aria-hidden="true"
        >
          <img src={sideFrameSvg} alt="Side Frame" className="w-[var(--px-1280)]" />
        </div>

        {/* Content-specific Background Noise - only within content layer */}
        <BackgroundNoise zIndex={5} />

        {/* Actual Content Sections */}
        <Navbar logo={<LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} />
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
    </>
  );
}
