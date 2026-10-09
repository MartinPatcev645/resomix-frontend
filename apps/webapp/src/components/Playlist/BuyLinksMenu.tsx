import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TraxsourceIcon from "@/assets/icons/stores/traxsource.svg";
import BandcampIcon from "@/assets/icons/stores/bandcamp.svg";
import { pushStoreLinkClicked } from "@resomix/hooks";
import type { BuyLink, BuyStore, StoreLinkTracking } from "@/utils/trackUtils.ts";

/**
 * The closed row's buy button: a small cart in the brand colour right after the title, in the same
 * spot on every row so the eye learns it (George's layout, October 2026). It opens a short menu with
 * the same store links the playing row shows as "GET IT // ...". A row with no store link keeps an
 * empty slot of the same width, so every title lines up. A click on a store is logged as
 * `store_link_clicked` with `row_state: "closed"` (bought while scrolling).
 *
 * The menu is portalled and fixed-positioned under the button, so neither the table's sticky header
 * nor the sticky reference bar can clip or cover it. It closes on an outside click, Escape, scroll
 * or resize.
 */
interface BuyLinksMenuProps {
  links: BuyLink[];
  tracking: StoreLinkTracking;
  /** Smaller square for the mobile title line, so the row does not grow taller. */
  compact?: boolean;
  className?: string;
}

const STORE_ICONS: Record<BuyStore, string> = {
  traxsource: TraxsourceIcon,
  bandcamp: BandcampIcon,
};

/** The app's cart glyph (the same drawing as @resomix/ui's CartIcon), stroked in the current colour. */
function CartGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7.2998 5H22L20 12H8.37675M21 16H9L7 3H4M4 8H2M5 11H2M6 14H2M10 20C10 20.5523 9.55228 21 9 21C8.44772 21 8 20.5523 8 20C8 19.4477 8.44772 19 9 19C9.55228 19 10 19.4477 10 20ZM21 20C21 20.5523 20.5523 21 20 21C19.4477 21 19 20.5523 19 20C19 19.4477 19.4477 19 20 19C20.5523 19 21 19.4477 21 20Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BuyLinksMenu({ links, tracking, compact = false, className = "" }: BuyLinksMenuProps) {
  const SLOT = compact ? "h-[var(--px-18)] w-[var(--px-18)] shrink-0" : "h-[var(--px-26)] w-[var(--px-26)] shrink-0";
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, pos, close]);

  if (links.length === 0) return <span aria-hidden="true" className={`${SLOT} ${className}`.trim()} />;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Buy this track"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Buy this track"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`${SLOT} inline-flex items-center justify-center rounded-[var(--rx-radius-control)] border text-[var(--color-accent,#EE4A26)] transition-colors hover:cursor-pointer hover:border-[var(--color-accent,#EE4A26)] hover:bg-[rgba(238,74,38,0.12)] ${
          open ? "border-[var(--color-accent,#EE4A26)] bg-[rgba(238,74,38,0.12)]" : "border-[var(--rx-color-border-default)]"
        } ${className}`.trim()}
      >
        <CartGlyph className={compact ? "h-[var(--px-12)] w-[var(--px-12)]" : "h-[var(--px-16)] w-[var(--px-16)]"} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Buy this track"
            style={{ position: "fixed", top: pos.top, right: pos.right }}
            className="z-[60] min-w-[var(--px-170)] rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-[#111] py-[var(--px-4)] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          >
            {links.map((link) => (
              <a
                key={link.store}
                role="menuitem"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  pushStoreLinkClicked({ store: link.store, rowState: "closed", ...tracking });
                  close();
                }}
                className="flex items-center gap-[var(--px-8)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-12)] text-[var(--rx-color-text-secondary)] outline-none transition-colors hover:bg-white/5 hover:text-[var(--rx-color-text-primary)] focus-visible:bg-white/5 focus-visible:text-[var(--rx-color-text-primary)]"
              >
                <img src={STORE_ICONS[link.store]} alt="" aria-hidden="true" draggable={false} className="h-[var(--px-16)] w-[var(--px-16)]" />
                Buy on {link.label}
              </a>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default BuyLinksMenu;
