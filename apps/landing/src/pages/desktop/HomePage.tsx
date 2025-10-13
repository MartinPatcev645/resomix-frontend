import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { HomeHero, HomeOne, HomeTwo, HomeThree, HomeFour, HomeFive, HomeSix, HomeSeven, HomeEight, HomeNine } from "@/sections/desktop/index.ts";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

export function HomePage() {
  return (
    <div className="bg-[var(--color-secondary)]">
      {/* Static noise now overscans 50 vh above & below viewport to avoid flashes during fast scroll */}
      {/* <StaticNoise color="#313132" opacity={0.5} zIndex={1} overscanVh={50} /> */}
      <StaticNoise />

      {/* Content layer */}
      <div
        style={{
          margin: '0 auto',
          color: 'var(--color-text-secondary)',
          position: 'relative',
          zIndex: 30,
          maxWidth: '2560px',
          overflowX: "hidden"
        }}
      >
        <SideLines>
          {/* Actual Content Sections */}
          <Navbar
            logo={<a href={BASE_LANDING_URL} className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="home"
            baseUrl={BASE_LANDING_URL}
            baseBetaUrl={BASE_BETA_URL}
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
          <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
        </SideLines>
      </div>
    </div>
  );
}
