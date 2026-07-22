import React, { useState, useRef, useLayoutEffect, useEffect } from "react";

// Shared menu-item styling (matches the parent library dropdown).
const ITEM_CLASS =
  "w-full flex items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] text-[length:var(--px-12)] font-light font-helvetica hover:bg-white/5 active:bg-white/10 transition-colors duration-150 cursor-pointer text-white/80 hover:text-white";

interface ExportSubmenuProps {
  /** Chosen an export target (Apple Music for now). Parent runs the entitlement gate + modal. */
  onExportApple: () => void;
}

/**
 * "Export" row inside the library playlist dropdown that flies out a secondary menu of export
 * targets (Apple Music for now; more later). Standard submenu behaviour: opens on hover (desktop)
 * and toggles on click. It opens to the RIGHT by default, but flips to the LEFT if that would spill
 * off-screen (mobile / near the edge), measured before paint — so it never overflows the viewport.
 */
export const ExportSubmenu: React.FC<ExportSubmenuProps> = ({ onExportApple }) => {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"right" | "left">("right");
  const subRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Measured while positioned right; if it spills past the viewport, flip left (one-way, converges).
  useLayoutEffect(() => {
    if (!open || !subRef.current) return;
    const rect = subRef.current.getBoundingClientRect();
    if (side === "right" && rect.right > window.innerWidth - 8) setSide("left");
  }, [open, side]);

  const clearTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    clearTimer();
    setSide("right"); // reset so each open re-evaluates the best side
    setOpen(true);
  };
  const closeSoon = () => {
    clearTimer();
    // Small delay bridges the hover gap between the row and the flyout (desktop hover intent).
    closeTimer.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => () => clearTimer(), []);

  return (
    <div className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setSide("right"); setOpen((v) => !v); }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${ITEM_CLASS} justify-between`}
        id="library-export-submenu-trigger"
      >
        <span className="flex items-center gap-[var(--px-12)]">
          <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
            <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
            </svg>
          </span>
          <span className="whitespace-nowrap leading-none">Export</span>
        </span>
        {/* Chevron points toward the flyout (flips when it opens to the left). */}
        <svg className={`w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current transition-transform ${side === "left" ? "rotate-180" : ""}`} strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {open && (
        <div
          ref={subRef}
          role="menu"
          className={`absolute top-0 ${side === "right" ? "left-full" : "right-full"} w-[var(--px-180)] bg-[var(--color-secondary)] border border-dotted border-slate-200/60 rounded-xs shadow-2xl z-30 py-[var(--px-4)]`}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onExportApple(); }}
            className={ITEM_CLASS}
            id="library-export-apple"
          >
            <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
              <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.99-.76.85-2.02 1.51-3.06 1.43-.13-1.1.42-2.27 1.09-3 .76-.83 2.09-1.46 3.09-1.42zM20.6 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.94-1-4.03-.99-2.09.01-2.53.99-4.07.98-1.73-.01-3.05-1.77-4.04-3.34-2.77-4.4-3.06-9.56-1.35-12.3 1.21-1.95 3.13-3.1 4.93-3.1 1.84 0 2.99 1.01 4.51 1.01 1.47 0 2.37-1.01 4.5-1.01 1.6 0 3.3.87 4.51 2.38-3.96 2.17-3.31 7.82.21 9.42z" />
              </svg>
            </span>
            <span className="whitespace-nowrap leading-none">Export to Apple Music</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportSubmenu;
