// import { Navbar } from "@resomix/ui";
import { Navbar, StaticNoise } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, SectionEight, SectionNine, FooterSection } from "../../sections/index.ts";
import sideFrameSvg from "../../assets/icons/layout/side_frame.svg";
import { LogoHeader } from "../../components/LogoHeader.tsx";

export function HomePage() {
  return (
    <>
      {/* Static noise now overscans 50 vh above & below viewport to avoid flashes during fast scroll */}
      <StaticNoise color="#313132" opacity={0.7} zIndex={1} overscanVh={50} />

      {/* Content layer */}
      <div
        style={{
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          maxWidth: '2560px',
        }}
      >

        {/* SVG Overlay inside 1280px content */}
        <div
          className="absolute top-0 max-w-full max-h-full pointer-events-none z-30"
          aria-hidden="true"
        >
          <img src={sideFrameSvg} alt="Side Frame" className="w-[var(--px-1280)]" />
        </div>

        {/* Content-specific Static Noise - within content layer */}
        {/* <StaticNoise color="#313132" zIndex={5} opacity={0.4}/> */}

        {/* Actual Content Sections */}
        <Navbar logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>} />
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
