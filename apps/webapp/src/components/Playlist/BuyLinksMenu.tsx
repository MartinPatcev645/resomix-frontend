import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TraxsourceIcon from "@/assets/icons/stores/traxsource.svg";
import BandcampIcon from "@/assets/icons/stores/bandcamp.svg";
import type { BuyLink, BuyStore } from "@/utils/trackUtils.ts";

/**
 * The closed row's buy button: a small "$" right after the title, in the same spot on every row so
 * the eye learns it (George's layout, October 2026). It opens a short menu with the same store links
 * the playing row shows as "GET IT // ...". A row with no store link keeps an empty slot of the same
 * width, so every title lines up.
 *
 * The menu is portalled and fixed-positioned under the button, so neither the table's sticky header
 * nor the sticky reference bar can clip or cover it. It closes on an outside click, Escape, scroll
 * or resize.
 */
interface BuyLinksMenuProps {
  links: BuyLink[];
  /** Smaller square for the mobile title line, so the row does not grow taller. */
  compact?: boolean;
  className?: string;
}

const STORE_ICONS: Record<BuyStore, string> = {
  traxsource: TraxsourceIcon,
  bandcamp: BandcampIcon,
};

export function BuyLinksMenu({ links, compact = false, className = "" }: BuyLinksMenuProps) {
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
        className={`${SLOT} inline-flex items-center justify-center rounded-[var(--rx-radius-control)] border font-fira ${compact ? "text-[length:var(--px-11)]" : "text-[length:var(--px-12)]"} transition-colors hover:cursor-pointer hover:border-[var(--color-accent,#EE4A26)] hover:text-[var(--color-accent,#EE4A26)] ${
          open
            ? "border-[var(--color-accent,#EE4A26)] text-[var(--color-accent,#EE4A26)]"
            : "border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)]"
        } ${className}`.trim()}
      >
        $
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
