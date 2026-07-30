import React, { useState } from "react";

// Menu-item styling (matches the parent library dropdown).
const ITEM_CLASS =
  "w-full flex items-center gap-[var(--px-12)] px-[var(--px-16)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)] transition-colors duration-150 cursor-pointer hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] active:bg-[rgba(255,255,255,0.1)]";
// Nested (sub-option) styling — indented so it reads as a child of "Export". Explicit pl/pr avoids
// the px-/pl- collision.
const SUB_ITEM_CLASS =
  "w-full flex items-center gap-[var(--px-12)] pl-[var(--px-34)] pr-[var(--px-16)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)] transition-colors duration-150 cursor-pointer hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--rx-color-text-primary)] active:bg-[rgba(255,255,255,0.1)]";

interface ExportSubmenuProps {
  /** Chosen an export target (Apple Music for now). Parent runs the entitlement gate + modal. */
  onExportApple: () => void;
  /** Chosen the iframe embed target. Parent opens the Embed modal (public-only, guarded there). */
  onEmbed: () => void;
}

/**
 * "Export" row inside the library playlist dropdown. Rather than a side flyout (cramped given the
 * limited horizontal space on the library rows / mobile), it's an in-place ACCORDION: click "Export"
 * (down-chevron) to expand the export targets (Apple Music for now; more later) directly below it,
 * within the same dropdown. The dropdown just grows taller — nothing flies off-screen.
 */
export const ExportSubmenu: React.FC<ExportSubmenuProps> = ({ onExportApple, onEmbed }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        aria-expanded={expanded}
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
        {/* Down-chevron; rotates to point up while expanded. */}
        <svg className={`w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current transition-transform duration-150 ${expanded ? "rotate-180" : ""}`} strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-white/[0.03]">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); onExportApple(); }}
            className={SUB_ITEM_CLASS}
            id="library-export-apple"
          >
            <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
              <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.99-.76.85-2.02 1.51-3.06 1.43-.13-1.1.42-2.27 1.09-3 .76-.83 2.09-1.46 3.09-1.42zM20.6 17.02c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.01-1.94-1-4.03-.99-2.09.01-2.53.99-4.07.98-1.73-.01-3.05-1.77-4.04-3.34-2.77-4.4-3.06-9.56-1.35-12.3 1.21-1.95 3.13-3.1 4.93-3.1 1.84 0 2.99 1.01 4.51 1.01 1.47 0 2.37-1.01 4.5-1.01 1.6 0 3.3.87 4.51 2.38-3.96 2.17-3.31 7.82.21 9.42z" />
              </svg>
            </span>
            <span className="whitespace-nowrap leading-none">Apple Music</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(false); onEmbed(); }}
            className={SUB_ITEM_CLASS}
            id="library-export-embed"
          >
            <span className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] flex items-center justify-center">
              <svg className="w-[var(--px-14)] h-[var(--px-14)] fill-none stroke-current" strokeWidth="1.7" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 9l-4 3 4 3M16 9l4 3-4 3M13 6l-2 12" />
              </svg>
            </span>
            <span className="whitespace-nowrap leading-none">Embed (iframe)</span>
          </button>
        </div>
      )}
    </>
  );
};

export default ExportSubmenu;
