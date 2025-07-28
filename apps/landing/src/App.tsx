import { Navbar } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, SectionEight, SectionNine, FooterSection } from "./sections/index.ts";
import { BackgroundNoise } from "./components/index.ts";
import sideFrameSvg from "./assets/icons/layout/side_frame.svg";
import logoHeaderSvg from "./assets/icons/logo header.svg";

function App() {
  return (
    <div className="bg-black w-full min-h-full relative">
      {/* Global Background Noise - covers entire viewport */}
      <BackgroundNoise zIndex={1} />

      {/* Content layer */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          minHeight: '100vh',
        }} className="bg-black"
      >
        
      {/* SVG Overlay inside 1280px content */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1280px] h-full pointer-events-none z-30"
        aria-hidden="true"
      >
        <img src={sideFrameSvg} alt="Side Frame" />

      </div>
        {/* Content-specific Background Noise - only within content layer */}
        <BackgroundNoise zIndex={5} />
        
        {/* Actual Content Sections */}
        <Navbar logo={<img src={logoHeaderSvg} alt="ResomiX Logo" />} />
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
