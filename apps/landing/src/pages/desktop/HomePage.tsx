import { Navbar, StaticNoise, GlobalFooter } from "@resomix/ui";
import { HomeHero, HomeOne, HomeTwo, HomeThree, HomeFour, HomeFive, HomeSix, HomeSeven, HomeEight, HomeNine } from "@/sections/desktop/index.ts";
import sideFrameSvg from "@/assets/icons/layout/side_frame.svg";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";

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

        {/* Actual Content Sections */}
        <Navbar logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>} />
        <HomeHero />
        <HomeOne />
        <HomeTwo />
        <HomeThree />
        <HomeFour />
        <HomeFive />
        <HomeSix />
        <HomeSeven />
        <HomeEight />
        <HomeNine />
        <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} />
      </div>
    </>
  );
}
