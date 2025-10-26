import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { AboutHero, AboutOne, AboutTwo, AboutThree, AboutFour } from "@/sections/desktop/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";
import { useLocation } from "react-router-dom";

export function AboutPage() {
  const location = useLocation();
  
  return (
    <div className="bg-[var(--color-secondary)]">
      {/* Static noise background */}
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
          overflowX: 'hidden',
        }}
      >
        {/* Content Layer */}
        <SideLines>
          <div className="">
            {/* Navbar */}
            <Navbar
              logo={<a href={BASE_LANDING_URL} aria-label="Resomix home" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
              baseUrl={BASE_LANDING_URL}
              baseBetaUrl={BASE_BETA_URL}
              mode="home"
              customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
              currentPath={location.pathname}
            />

            <AboutHero />
            <AboutOne />
            <AboutTwo />
            <AboutThree />
            <AboutFour />
            <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
          </div>
        </SideLines>
      </div>
    </div>
  );
}
