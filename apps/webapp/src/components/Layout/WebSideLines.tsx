import React from "react";

interface WebSideLinesProps {
  children?: React.ReactNode;
  navbar?: React.ReactNode;
  mode?: string;
  /** Single-mount breakpoint — renders one frame tree, never CSS-hides a duplicate. */
  isDesktop: boolean;
}

/**
 * Webapp frame wrapper — same visual contract as `@resomix/ui` SideLines, but mounts
 * `{children}` once per breakpoint (SideLines duplicates children in both hidden branches).
 */
export function WebSideLines({ children, navbar, mode = "about", isDesktop }: WebSideLinesProps) {
  const isHeroPage = mode === "about" || mode === "upload" || mode === "playlist" || mode === "home";

  if (isDesktop) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />
        <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1" />

        <div className="mx-[var(--px-20)] md:mx-[var(--px-63)] relative flex-1 flex flex-col">
          {/* Vertical side lines — inset-0 so they span the FULL height of this box, which now
              fills the viewport via the flex-col chain (sticky footer), reaching the bottom. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
            <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
            <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
          </div>

          {!isHeroPage && (
            <svg
              viewBox="0 0 1152 628"
              preserveAspectRatio="none"
              className="absolute left-0 top-[var(--px-65)] w-full h-[length:var(--px-628)] pointer-events-none z-10"
            >
              <path
                d="M0.333008 1.07413H279.222L347.74 40.6333H779.963L848.481 1.07413H1152"
                stroke="#eceaeaff"
                strokeOpacity="1"
                strokeWidth="1"
                strokeDasharray="0.74 0.74"
                fill="none"
              />
            </svg>
          )}

          {children}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="absolute left-0 top-[var(--px-24)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1" />
      {(mode === "about" || mode === "upload") && (
        <div className="absolute left-0 top-[var(--px-716)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1" />
      )}

      <div className="mx-[var(--px-20)] h-full min-h-screen pt-[var(--px-28)] relative z-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
          <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
          <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
        </div>
        <header>{navbar}</header>
        {children}
      </div>
    </div>
  );
}
