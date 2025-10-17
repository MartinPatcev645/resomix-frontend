import React from "react";

interface SideLinesProps {
    children?: React.ReactNode;
    navbar?: React.ReactNode;
    hero?: React.ReactNode;
    mode?: string;
    className?: string;
}

export const SideLines: React.FC<SideLinesProps> = ({ children, navbar, hero, mode = "about", className }) => (
    <>
        <div className="hidden lg:block">
            {/* Four lines around hero section to maintain design consistency */}
            <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
            </div>
            <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
            </div>
            <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
            </div>
            <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
            </div>

            {/* Content */}
            <div className={`${className ?? "mx-[var(--px-20)] md:mx-[var(--px-63)] relative"}`}>
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
                    <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
                    <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
                </div>
                {children}
            </div>
        </div>
        <div className="block lg:hidden">
            {/* Four lines around hero section to maintain design consistency */}
            <div className="absolute left-0 top-[var(--px-24)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1">
            </div>
            {/* Display bottom line only on About and Upload pages */}
            {(mode === "about" || mode === "upload") && (
                <div className="absolute left-0 top-[var(--px-716)] w-full border-t border-slate-200 border-dotted pointer-events-none z-1">
                </div>
            )}

            {/* Main Content */}
            <div className="mx-[var(--px-20)] h-full min-h-screen pt-[var(--px-28)] relative z-20">
                {/* Vertical border overlay so borders sit above inner content */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
                    <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
                    <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
                </div>
                {/* Navbar & Hero Section */}
                <header>
                    {navbar}
                </header>
                {/* Display Hero only on About and Upload pages */}
                {(mode === "about" || mode === "upload" || mode === "playlist") && (
                    hero
                )}
                {/* Actual Content */}
                {children}
            </div>
        </div>
    </>
);
