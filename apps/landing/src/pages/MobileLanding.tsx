import { Navbar, StaticNoise } from "@resomix/ui";
import {
  HeroSection,
  SectionOne,
  SectionTwo,
  SectionThree,
  SectionFour,
  SectionFive,
  SectionSix,
  SectionSeven,
  SectionEight,
  SectionNine,
  FooterSection,
} from "../mobile_sections/index.ts";
import { LogoHeader } from "../components/LogoHeader.tsx";

export function MobileLanding() {
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
        className="bg-black min-h-screen px-4 py-6"
      >
        {/* Navbar */}
        <Navbar
          logo={<a href="https://resomix.com" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
        />

        {/* Content Sections */}
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

        {/* Footer */}
        <FooterSection />
      </div>
    </>
  );
}
