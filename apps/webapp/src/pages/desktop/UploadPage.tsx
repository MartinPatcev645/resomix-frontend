import { Navbar, StaticNoise, GlobalFooter } from "@resomix/ui";
import { LogoHeader, LogoRFooter } from "@/components/index.ts";
import { UploadHero, UploadOne } from "@/sections/desktop/index.ts";
// import sideFrameSvg from "@/assets/icons/layout/desktop_side_frame_flexible.svg";

export function UploadPage() {
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
        {/* Four lines around hero section to maintain design consistency */}
        <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>

        <div className="border-l border-r border-dotted border-slate-200 mx-[var(--px-63)]">
          {/* Navbar */}
          <Navbar
            logo={<a href="/" className="cursor-default"><LogoHeader className="w-[var(--px-110)] h-[var(--px-16)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" /></a>}
            mode="upload"
            customClass="flex justify-between items-center align-center pt-[var(--px-28)] z-20 relative"
          />

          <UploadHero />
          <UploadOne />
          <GlobalFooter logo={<LogoRFooter className="w-[var(--px-27)] h-[var(--px-27)] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors" />} />
        </div>
      </div>
    </>
  );
}
