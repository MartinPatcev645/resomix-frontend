import React from "react";

/**
 * Shared chrome for the playlist hero toolbar controls (Back / Autoplay / Rename / Export / Share).
 *
 * Every control renders with the SAME shape: transparent background at rest AND on hover (no more
 * translucent-white fill), a subtle border, and one text + icon size. Hover turns the text, border
 * and icons neon — nothing else. Icons recolour to the button's own text colour (masked SVGs use
 * `bg-current`; inline SVGs use `currentColor`), so they follow the neon-on-hover treatment for free.
 */
export const HERO_TOOLBAR_BTN =
  "group inline-flex min-h-[var(--px-44)] items-center justify-center gap-[var(--px-8)] " +
  "rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent " +
  "px-[var(--px-14)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] " +
  "text-[var(--rx-color-text-primary)] transition-[color,border-color] duration-[var(--rx-duration-base,150ms)] ease-out " +
  "hover:border-[var(--color-primary,#EE4A26)] hover:text-[var(--color-primary,#EE4A26)]";

/**
 * A monochrome SVG asset recoloured to the current text colour via CSS masking — so an `<img>`-style
 * SVG follows the button's neon-on-hover text colour without needing a separate coloured asset.
 */
export const HeroMaskIcon: React.FC<{ src: string; className?: string }> = ({ src, className = "" }) => (
  <span
    aria-hidden="true"
    className={`inline-block h-[var(--px-16)] w-[var(--px-16)] shrink-0 bg-current ${className}`}
    style={{
      maskImage: `url(${src})`,
      WebkitMaskImage: `url(${src})`,
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskPosition: "center",
      WebkitMaskPosition: "center",
      maskSize: "contain",
      WebkitMaskSize: "contain",
    }}
  />
);

/** Left chevron for the Back control — inline SVG in `currentColor`, matched to the icon size. */
export const HeroChevronLeft: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-[var(--px-16)] w-[var(--px-16)] shrink-0"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/**
 * Autoplay glyph. Persisted state colour, independent of hover: when `on` it is forced neon; when
 * off it inherits the button's text colour (white at rest, neon on hover).
 */
export const HeroAutoplayIcon: React.FC<{ on: boolean }> = ({ on }) => (
  <svg
    viewBox="0 0 24 24"
    className={`h-[var(--px-16)] w-[var(--px-16)] shrink-0 ${on ? "text-[var(--color-primary,#EE4A26)]" : ""}`}
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);
