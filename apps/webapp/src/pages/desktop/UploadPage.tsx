import { Navbar, StaticNoise, GlobalFooter, SideLines } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { UploadHero, UploadOne } from "@/sections/desktop/index.ts";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

export function UploadPage() {
  return (
    <div className="bg-[var(--color-secondary)]">
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
          overflowX: "hidden"
        }}
      >
        <SideLines>
          {/* Navbar */}
          <Navbar
            logo={<a href={BASE_BETA_URL} className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="upload"
            baseUrl={BASE_LANDING_URL}
            baseBetaUrl={BASE_BETA_URL}
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          />

          <UploadHero />
          <UploadOne />
          <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} baseUrl={BASE_LANDING_URL} />
        </SideLines >
      </div>
    </div>
  );
}
