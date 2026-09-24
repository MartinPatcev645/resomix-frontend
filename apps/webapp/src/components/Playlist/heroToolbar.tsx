import React from "react";

/**
 * Shared chrome for the playlist hero toolbar controls (Back / Autoplay / Rename / Export / Share).
 *
 * Every control renders with the SAME shape: transparent background at rest AND on hover (no more
 * translucent-white fill), a subtle border, one text size, and 16px icons on a single line. Hover
 * turns the text, border and icons neon — nothing else. Icons are inline SVGs painted in
 * `currentColor`, so they follow the button's neon-on-hover text colour for free (the earlier CSS
 * `mask-image` approach rendered as solid white blocks and is gone).
 */
/**
 * THE hero control. Every button in the playlist hero uses this — Back, Rename, Export, Share,
 * Autoplay, favourite heart, public/private, the cover pencil and Rate — so they all share one
 * hover: border and glyph/text move to --color-primary together, background never changes.
 * Icon-only controls override padding/size; the cover pencil also overrides the background,
 * because it sits on the artwork and must stay opaque.
 */
const HERO_TOOLBAR_SHAPE =
  "group inline-flex min-h-[var(--px-44)] cursor-pointer items-center justify-center gap-[var(--px-6)] whitespace-nowrap " +
  "rounded-[var(--rx-radius-control)] bg-transparent " +
  "px-[var(--px-14)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] " +
  "text-[var(--rx-color-text-primary)] transition-[color,border-color] duration-[var(--rx-duration-base,150ms)] ease-out";

export const HERO_TOOLBAR_BTN =
  `${HERO_TOOLBAR_SHAPE} border border-[var(--rx-color-border-default)] ` +
  "hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]";

/**
 * The way OUT of a page, wherever one exists.
 *
 * Same button in every respect but the edge, which is the accent rather than the default border so
 * the one control that leaves the page is the one that is visible at a glance. The label and the
 * destination change from page to page (Sonic Discovery, Back to Library, Back to Upload); the
 * button does not. The webapp's `BackButton` and the playlist hero both wear this, and
 * `PAGE_BTN_BACK` in `@resomix/ui` is the same treatment for the pages that live in that package.
 */
export const HERO_TOOLBAR_BACK =
  `${HERO_TOOLBAR_SHAPE} border border-[var(--rx-color-accent)] ` +
  "hover:border-[var(--rx-color-accent-hover)] hover:text-[var(--rx-color-accent-hover)]";

const ICON = "h-[var(--px-16)] w-[var(--px-16)] shrink-0";

/** Left chevron for the Back control. */
export const HeroChevronLeft: React.FC = () => (
  <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const RenameIcon: React.FC = () => (
  <svg viewBox="0 0 12 12" className={ICON} fill="none" aria-hidden="true">
    <path
      fill="currentColor"
      d="M5.03516 0.857147C4.94991 0.857147 4.86815 0.891012 4.80787 0.951291C4.74759 1.01157 4.71373 1.09333 4.71373 1.17858C4.71373 1.26382 4.74759 1.34558 4.80787 1.40586C4.86815 1.46614 4.94991 1.5 5.03516 1.5H5.67801V10.5H5.03516C4.94991 10.5 4.86815 10.5339 4.80787 10.5941C4.74759 10.6544 4.71373 10.7362 4.71373 10.8214C4.71373 10.9067 4.74759 10.9884 4.80787 11.0487C4.86815 11.109 4.94991 11.1429 5.03516 11.1429H6.96373C7.04898 11.1429 7.13073 11.109 7.19101 11.0487C7.25129 10.9884 7.28516 10.9067 7.28516 10.8214C7.28516 10.7362 7.25129 10.6544 7.19101 10.5941C7.13073 10.5339 7.04898 10.5 6.96373 10.5H6.32087V1.5H6.96373C7.04898 1.5 7.13073 1.46614 7.19101 1.40586C7.25129 1.34558 7.28516 1.26382 7.28516 1.17858C7.28516 1.09333 7.25129 1.01157 7.19101 0.951291C7.13073 0.891012 7.04898 0.857147 6.96373 0.857147H5.03516ZM2.67801 2.58H5.24944V3.22286H2.67801C2.4791 3.22286 2.28834 3.30188 2.14768 3.44253C2.00703 3.58318 1.92801 3.77395 1.92801 3.97286V8.04429C1.92801 8.45829 2.26401 8.79429 2.67801 8.79429H5.24944V9.43715H2.67801C2.3086 9.43715 1.95433 9.2904 1.69311 9.02919C1.4319 8.76798 1.28516 8.4137 1.28516 8.04429V3.97286C1.28516 3.60345 1.4319 3.24917 1.69311 2.98796C1.95433 2.72675 2.3086 2.58 2.67801 2.58ZM9.32087 8.79429H6.74944V9.43715H9.32087C9.69028 9.43715 10.0446 9.2904 10.3058 9.02919C10.567 8.76798 10.7137 8.4137 10.7137 8.04429V3.97286C10.7137 3.60345 10.567 3.24917 10.3058 2.98796C10.0446 2.72675 9.69028 2.58 9.32087 2.58H6.74944V3.22286H9.32087C9.73487 3.22286 10.0709 3.55843 10.0709 3.97286V8.04429C10.0709 8.2432 9.99185 8.43397 9.8512 8.57462C9.71055 8.71527 9.51978 8.79429 9.32087 8.79429Z"
    />
  </svg>
);

export const ExportIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className={ICON} fill="none" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 5L11.2929 4.29289L12 3.58579L12.7071 4.29289L12 5ZM13 14C13 14.5523 12.5523 15 12 15C11.4477 15 11 14.5523 11 14L13 14ZM6.29289 9.29289L11.2929 4.29289L12.7071 5.70711L7.70711 10.7071L6.29289 9.29289ZM12.7071 4.29289L17.7071 9.29289L16.2929 10.7071L11.2929 5.70711L12.7071 4.29289ZM13 5L13 14L11 14L11 5L13 5Z"
    />
    <path stroke="currentColor" strokeWidth={2} d="M5 16L5 17C5 18.1046 5.89543 19 7 19L17 19C18.1046 19 19 18.1046 19 17V16" />
  </svg>
);

export const ShareIcon: React.FC = () => (
  <svg viewBox="0 0 14 14" className={ICON} fill="none" aria-hidden="true">
    <path
      stroke="currentColor"
      strokeWidth={0.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.45833 3.79167L5.54167 5.83333M8.45833 10.2083L5.54167 8.16667M5.54167 7C5.54167 7.38677 5.38802 7.75771 5.11453 8.0312C4.84104 8.30469 4.47011 8.45833 4.08333 8.45833C3.69656 8.45833 3.32563 8.30469 3.05214 8.0312C2.77865 7.75771 2.625 7.38677 2.625 7C2.625 6.61323 2.77865 6.24229 3.05214 5.9688C3.32563 5.69531 3.69656 5.54167 4.08333 5.54167C4.47011 5.54167 4.84104 5.69531 5.11453 5.9688C5.38802 6.24229 5.54167 6.61323 5.54167 7ZM11.375 10.7917C11.375 11.1784 11.2214 11.5494 10.9479 11.8229C10.6744 12.0964 10.3034 12.25 9.91667 12.25C9.52989 12.25 9.15896 12.0964 8.88547 11.8229C8.61198 11.5494 8.45833 11.1784 8.45833 10.7917C8.45833 10.4049 8.61198 10.034 8.88547 9.76047C9.15896 9.48698 9.52989 9.33333 9.91667 9.33333C10.3034 9.33333 10.6744 9.48698 10.9479 9.76047C11.2214 10.034 11.375 10.4049 11.375 10.7917ZM11.375 3.20833C11.375 3.59511 11.2214 3.96604 10.9479 4.23953C10.6744 4.51302 10.3034 4.66667 9.91667 4.66667C9.52989 4.66667 9.15896 4.51302 8.88547 4.23953C8.61198 3.96604 8.45833 3.59511 8.45833 3.20833C8.45833 2.82156 8.61198 2.45063 8.88547 2.17714C9.15896 1.90365 9.52989 1.75 9.91667 1.75C10.3034 1.75 10.6744 1.90365 10.9479 2.17714C11.2214 2.45063 11.375 2.82156 11.375 3.20833Z"
    />
  </svg>
);

/**
 * Duration marker for the hero meta line. Replaces the `⧖` glyph, which renders as a thin, uneven
 * hourglass (or a tofu box) depending on the platform font. `inline-block` + baseline nudge keeps it
 * in the text flow, so the meta line still wraps naturally.
 */
export const HeroClockIcon: React.FC = () => (
  <svg
    viewBox="0 0 24 24"
    className="inline-block h-[var(--px-11)] w-[var(--px-11)] shrink-0 align-[-0.15em]"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 6.75 12 12 15.5 14" />
  </svg>
);

/**
 * Autoplay control glyph — a real toggle switch (track + knob), NOT a play icon. Persisted state,
 * independent of hover: ON → neon, knob to the right; OFF → white, knob to the left.
 */
export const HeroAutoplayToggle: React.FC<{ on: boolean }> = ({ on }) => (
  <svg
    viewBox="0 0 28 16"
    className={`h-[var(--px-16)] w-[var(--px-28)] shrink-0 ${on ? "text-[var(--rx-color-accent)]" : "text-white"}`}
    fill="none"
    aria-hidden="true"
  >
    <rect x="1" y="1" width="26" height="14" rx="7" stroke="currentColor" strokeWidth="1.6" />
    <circle cx={on ? 20 : 8} cy="8" r="4" fill="currentColor" />
  </svg>
);
