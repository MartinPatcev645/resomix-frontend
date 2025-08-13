import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { HomeHero, HomeOne, HomeTwo, HomeThree, HomeFour, HomeFive, HomeSix, HomeSeven, HomeEight, HomeNine } from "@/sections/desktop/index.ts";
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
        <SideLines>
          {/* Actual Content Sections */}
          <Navbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="home"
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative" />
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
        </SideLines>
      </div>
    </>
  );
}
