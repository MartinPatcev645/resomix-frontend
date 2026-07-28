import React from "react";

interface VoidFieldProps {
  /** Dark-mode plate (the base void-field image). */
  plateDark: string;
  /** Light-mode plate. */
  plateLight: string;
  /** Dark-mode grain (tiled texture over the plate). */
  grainDark: string;
  /** Light-mode grain. */
  grainLight: string;
}

/**
 * VoidField — the shared app-wide background.
 *
 * This is the exact plate + grain treatment used on the landing home page, extracted into one
 * self-contained component so every page (landing AND webapp) can share the identical backdrop.
 * Two fixed, full-viewport, non-interactive layers behind all content:
 *   • plate — the void-field image over `--color-secondary`, at 80% opacity.
 *   • grain — a 256px-tiled texture at 4.5% opacity.
 * Theme-aware: the `.light` root class swaps to the light plate/grain. Mount ONCE in the app shell,
 * before the content (content must sit in a positive stacking level, as the layouts already do).
 * Assets are passed in as URLs so each app supplies its own bundled copy.
 */
const VOID_FIELD_CSS = `
.rx-voidfield-plate,
.rx-voidfield-grain {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.rx-voidfield-plate {
  background: var(--color-secondary) var(--rx-vf-plate) center / cover no-repeat;
  opacity: 0.8;
}
.rx-voidfield-grain {
  background: var(--rx-vf-grain) repeat;
  background-size: 256px 256px;
  opacity: 0.045;
}
.light .rx-voidfield-plate { background-image: var(--rx-vf-plate-light); }
.light .rx-voidfield-grain { background-image: var(--rx-vf-grain-light); }
`;

export const VoidField: React.FC<VoidFieldProps> = ({
  plateDark,
  plateLight,
  grainDark,
  grainLight,
}) => (
  <div
    className="rx-voidfield"
    aria-hidden="true"
    style={
      {
        "--rx-vf-plate": `url(${plateDark})`,
        "--rx-vf-plate-light": `url(${plateLight})`,
        "--rx-vf-grain": `url(${grainDark})`,
        "--rx-vf-grain-light": `url(${grainLight})`,
      } as React.CSSProperties
    }
  >
    <style>{VOID_FIELD_CSS}</style>
    <div className="rx-voidfield-plate" />
    <div className="rx-voidfield-grain" />
  </div>
);

export default VoidField;
