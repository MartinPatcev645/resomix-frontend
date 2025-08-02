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
} from "../sections/index.ts";
import logoHeaderSvg from "../assets/icons/logo_header.svg";

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
          logo={
            <a href="https://resomix.com" className="cursor-default">
              <img
                className="w-20 h-4"
                src={logoHeaderSvg}
                alt="ResomiX Logo"
              />
            </a>
          }
        />

        {/* Content Sections */}
      </div>
    </>
  );
}
