import React from "react";

interface SideLinesProps {
    children?: React.ReactNode;
    navbar?: React.ReactNode;
    hero?: React.ReactNode;
    mode?: string;
    className?: string;
}

/**
 * The dotted-frame shell every marketing page sits inside.
 *
 * WHY THIS RENDERS `children` ONCE
 * --------------------------------
 * It used to render them TWICE — a full copy of the page inside `hidden lg:block` and another
 * inside `block lg:hidden`, with CSS showing one. `display: none` skips layout and paint, but the
 * browser still downloads, parses and style-matches the hidden copy, and on a throttled phone that
 * is not free: the homepage carried 2,573 DOM nodes and 187 KiB of markup where half would do.
 *
 * It went unnoticed because desktop absorbs the waste (PageSpeed desktop: ~10 Mbps, no CPU
 * throttle — a steady 99). Mobile emulates a Moto G Power at 4x CPU slowdown on Slow 4G, where the
 * same work is the difference between painting the hero and not: LCP sat at 4.7 s with a
 * 1,000 ms "element render delay" while TTFB was 20 ms. Nothing was waiting on the network.
 *
 * It also meant every `id` on the page existed twice, which is invalid HTML and why scrolling to an
 * anchor needs to hunt for the *visible* match (see LandingLayout).
 *
 * So: the frame decorations stay per-breakpoint, because they genuinely differ. The content does
 * not differ, and is rendered once.
 */
export const SideLines: React.FC<SideLinesProps> = ({ children, navbar, hero, mode = "about", className }) => {
    return (
        <>
            {/* Desktop frame: four short rules flanking the hero. */}
            <div className="hidden lg:block">
                <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
                <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
                <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
                <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
            </div>

            {/* Mobile frame: one rule across the top, plus a lower one on About and Upload. */}
            <div className="block lg:hidden">
                <div className="absolute left-0 top-[var(--px-24)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
                {/* Display bottom line only on About and Upload pages */}
                {(mode === "about" || mode === "upload") && (
                    <div className="absolute left-0 top-[var(--px-716)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1">
                    </div>
                )}
            </div>

            {/*
             * One content wrapper for both breakpoints.
             *
             * Each utility below carries the value the old branch used, scoped to the breakpoint
             * that branch was visible at. Two of them are easy to get wrong:
             *
             *   lg:mx-[--px-63]  the desktop branch said `md:`, but it was hidden below `lg` — so
             *                    768-1023px actually rendered the MOBILE branch at mx-20. Copying
             *                    `md:` here would silently widen every tablet's margins.
             *   lg:z-auto        `relative z-20` opens a stacking context; desktop had none, and
             *                    the page-scoped void-field backdrops depend on that (the same
             *                    trap that once washed out the beta banner).
             */}
            <div
                className={
                    className ??
                    "mx-[var(--px-20)] lg:mx-[var(--px-63)] relative z-20 lg:z-auto h-full lg:h-auto min-h-screen lg:min-h-0 pt-[var(--px-28)] lg:pt-0"
                }
            >
                {/* Vertical border overlay so borders sit above inner content */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
                    <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
                    <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
                </div>

                {/* Top frame outline — drawn on EVERY desktop page, so the navbar always sits on
                    the same dotted frame. It used to be skipped on the hero pages (home / about),
                    which left those pages with only the short side stubs and no line across. */}
                <svg
                    viewBox="0 0 1152 628"
                    preserveAspectRatio="none"
                    className="hidden lg:block absolute left-0 top-[var(--px-65)] w-full h-[length:var(--px-628)] pointer-events-none z-10"
                >
                    <path d="M0.333008 1.07413H279.222L347.74 40.6333H779.963L848.481 1.07413H1152"
                        stroke="#eceaeaff"
                        strokeOpacity="1"
                        strokeWidth="1"
                        strokeDasharray="0.74 0.74"
                        fill="none"
                    />
                </svg>

                {/* Navbar & Hero Section — mobile only. On desktop the caller puts its own navbar
                    in `children`, and passes no `navbar` prop at all. */}
                {navbar && <header className="lg:hidden">{navbar}</header>}

                {/* Display Hero only on About and Upload pages */}
                {(mode === "about" || mode === "upload" || mode === "playlist") && hero && (
                    <div className="lg:hidden">{hero}</div>
                )}

                {/* Actual Content */}
                {children}
            </div>
        </>
    );
};
