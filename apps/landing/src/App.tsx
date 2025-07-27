import { Navbar } from "@resomix/ui";
import { HeroSection } from "./sections/index.js";
import tvNoiseGif from "./assets/gifs/tv_noise.gif";

function App() {

  return (
    <div className="bg-black w-full h-full relative">
      {/* Background layer with opacity */}
      <div
        style={{
          backgroundImage: `url(${tvNoiseGif})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'absolute',
          minHeight: '100vh',
          width: '100%',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.30,
          zIndex: 1,
        }}
      />
      
      {/* Content layer */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', color: "var(--color-text-primary)", position: 'relative', zIndex: 5, minHeight: '100vh' }}>
        <Navbar />
        <HeroSection />
      </div>
    </div>
  );
}

export default App;
