import { Navbar } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, SectionEight, SectionNine, FooterSection } from "./sections/index.ts";
import { BackgroundNoise } from "./components/index.ts";
import sideFrameSvg from "./assets/icons/layout/side_frame.svg";
import logoHeaderSvg from "./assets/icons/logo_header.svg";

function App() {
  return (
    <div className="bg-black w-full min-h-full relative">
      {/* Global Background Noise - covers entire viewport */}
      <BackgroundNoise zIndex={1} />

      {/* Content layer */}
      <div
        style={{
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
        }} className="bg-black"
      >

        {/* SVG Overlay inside 1280px content */}
        <div
          className="absolute top-0 w-[var(--px-1280)] h-[var(--px-9137)] pointer-events-none z-30"
          aria-hidden="true"
        >
          <img src={sideFrameSvg} alt="Side Frame" />

        </div>
        {/* Content-specific Background Noise - only within content layer */}
        <BackgroundNoise zIndex={5} />

        {/* Actual Content Sections */}
        <Navbar logo={<img className="w-[var(--px-110)] h-[var(--px-16)]" src={logoHeaderSvg} alt="ResomiX Logo" />} />
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
  );
}

export default App;
