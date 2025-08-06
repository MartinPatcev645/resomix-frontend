import { Navbar, StaticNoise } from "@resomix/ui";
import { LogoHeader } from "../../components/index.ts";

export function HomePage() {
  return (
    <>
      {/* Static noise background */}
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
        {/* Navbar */}
        <Navbar logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>} />
        
        {/* Main Content */}
        <div className="min-h-screen flex flex-col items-center justify-center px-8">
          <h1 className="text-6xl font-bold font-helvetica mb-8 text-center">
            Welcome to Webapp
          </h1>
          <p className="text-xl font-helvetica text-center max-w-2xl mb-8">
            This is the webapp version with the same setup as the landing page. 
            All fonts, styles, and configurations have been copied over.
          </p>
          <div className="bg-white/10 p-8 rounded-lg backdrop-blur-sm">
            <h2 className="text-2xl font-helvetica mb-4">Features Ready:</h2>
            <ul className="space-y-2 font-helvetica">
              <li>✓ Responsive design (desktop/mobile)</li>
              <li>✓ Custom fonts (Helvetica, Auger, Fira, Montserrat, Benzin)</li>
              <li>✓ Tailwind configuration</li>
              <li>✓ CSS pixel system</li>
              <li>✓ Component library integration</li>
              <li>✓ Router setup</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
} 