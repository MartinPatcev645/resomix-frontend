import { Navbar } from "@resomix/ui";
import { HeroSection, SectionOne, SectionTwo, SectionThree, SectionFour, SectionFive, SectionSix, SectionSeven, AnimationsSection } from "./sections/index.js";
import tvNoiseGif from "./assets/gifs/tv_noise.gif";
import sideFrameSvg from "./assets/icons/layout/side_frame.svg";
import logoHeaderSvg from "./assets/icons/logo header.svg";

function App() {
  return (
    <div className="bg-black w-full min-h-full relative">
      {/* Background Animations */}
      <AnimationsSection />
      {/* Background Noise GIF layer with opacity */}
      <div
        style={{
          backgroundImage: `url(${tvNoiseGif})`,
          backgroundSize: 'auto',
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top left',
          position: 'absolute',
          width: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.30,
          zIndex: 20,
        }}
      />
      {/* SVG Overlay inside 1280px content */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[1280px] h-full pointer-events-none z-10"
        aria-hidden="true"
      >
        <img src={sideFrameSvg} alt="Side Frame" />

      </div>

      {/* Content layer */}
      <div
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          minHeight: '100vh',
        }} className="p-5"
      >
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
      </div>
    </div>
  );
}

export default App;
