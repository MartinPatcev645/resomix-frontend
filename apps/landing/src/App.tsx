import { Navbar } from "@resomix/ui";
import { HeroSection } from "./sections/index.js";
import tvNoiseGif from "./assets/gifs/tv_noise.gif";
import sideFrameSvg from "./assets/icons/layout/side_frame.svg";

function App() {
  return (
    <div className="bg-black w-full min-h-full relative">
      {/* Background layer with opacity */}
      <div
        style={{
          backgroundImage: `url(${tvNoiseGif})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'absolute',
          width: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.30,
          zIndex: 1,
        }} className="min-h-full"
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
          color: 'var(--color-text-primary)',
          position: 'relative',
          zIndex: 5,
          minHeight: '100vh',
        }} className="p-5"
      >
        <Navbar />
        <HeroSection />
      </div>
    </div>
  );
}

export default App;
