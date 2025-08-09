import { Navbar, StaticNoise } from "@resomix/ui";
import { LogoHeader } from "@/components/index.ts";
import { AboutHero, AboutOne, AboutFooter, AboutTwo, AboutThree, AboutFour } from "@/sections/desktop/index.ts";

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
          overflowX: 'hidden',
        }}
      >
        {/* Four lines around hero section to maintain design consistency */}
        <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>

      {/* Content Layer */}
        <div className="mx-[var(--px-63)] relative">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
            <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
            <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
          </div>

          {/* Navbar */}
          <Navbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="home"
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          />

          <AboutHero />
          <AboutOne />
          <AboutTwo />
          <AboutThree />
          <AboutFour />
          <AboutFooter />
        </div>
      </div>
    </>
  );
}
