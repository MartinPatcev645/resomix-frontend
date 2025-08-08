import { Navbar, StaticNoise } from "@resomix/ui";
import { LogoHeader } from "@/components/index.ts";
import { AboutHero, AboutOne, AboutFooter } from "@/sections/desktop/index.ts";
// import sideFrameSvg from "@/assets/icons/layout/desktop_side_frame_flexible.svg";

export function AboutPage() {
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
        <div className="border-l border-r border-dotted border-slate-200 mx-[var(--px-63)]">

          {/* SVG Overlay inside 1280px content */}
          {/* <div
            className="absolute top-0 max-w-full max-h-full pointer-events-none z-30"
            aria-hidden="true"
          >
            <img src={sideFrameSvg} alt="Side Frame" className="w-[var(--px-1280)]" />
          </div> */}

          {/* Navbar */}
          <Navbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="home"
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          />

          <AboutHero />
          <AboutOne />
          <AboutFooter />
        </div>
      </div>
    </>
  );
}
