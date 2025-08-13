import React from "react";

interface SideLinesProps {
    children?: React.ReactNode;
    className?: string;
}

export const SideLines: React.FC<SideLinesProps> = ({ children, className }) => (
    <>
        {/* Four lines around hero section to maintain design consistency */}
        <div className="absolute left-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-65)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute left-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>
        <div className="absolute right-0 top-[var(--px-691)] w-[var(--px-63)] border-t border-slate-200 border-dotted pointer-events-none z-1">
        </div>

        <div className={`${className ?? "mx-[var(--px-20)] md:mx-[var(--px-63)] relative"}`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[60]">
                <div className="absolute left-0 top-0 bottom-0 border-l border-dotted border-slate-200" />
                <div className="absolute right-0 top-0 bottom-0 border-r border-dotted border-slate-200" />
            </div>
            {children}
        </div>
    </>
);
