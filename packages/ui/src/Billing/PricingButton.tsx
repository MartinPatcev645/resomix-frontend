import type { ReactNode } from "react";

/**
 * The landing site's button, as used across every marketing page.
 *
 * The pricing page previously used `ButtonSleek`, which belongs to the older rounded/blurred
 * treatment and is still correct where the webapp uses it. Rather than restyle that shared control
 * and change it everywhere, this reproduces the marketing spec locally:
 *
 *   secondary — transparent, 1px hairline edge that brightens on hover
 *   primary   — the one filled control: accent fill, near-black label, and the notched
 *               top-right / bottom-left corners. Hover lifts the fill to a lighter tint rather
 *               than recolouring the label, which would be orange-on-orange.
 *
 * Fira Code at 12px / 0.09em / uppercase and a 44px minimum height match the marketing buttons
 * exactly — see `.ci-btn` and `.ci-hero .ci-btn.ci-primary` in the landing's section CSS.
 *
 * Disabled primary must not read as live: opacity alone on full accent still looks clickable on a
 * payment page, so the fill is desaturated and hover is suppressed.
 */

/** The corner notch. Expressed inline because the polygon's commas fight Tailwind's arbitrary-value parser. */
const NOTCH = {
  clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
} as const;

const BASE =
  "inline-flex items-center justify-center gap-[var(--px-8)] font-fira uppercase " +
  "text-[length:var(--px-12)] tracking-[0.09em] px-[var(--px-26)] py-[var(--px-14)] " +
  "min-h-[var(--px-44)] rounded-[var(--px-2)] border transition-colors duration-150";

const VARIANT = {
  primary:
    "bg-[var(--color-neon-orange)] border-[var(--color-neon-orange)] text-[#101010] font-semibold " +
    "hover:bg-[#f2603f] hover:border-[#f2603f]",
  secondary:
    "bg-transparent border-white/25 text-[var(--color-primary)] hover:border-[var(--color-primary)]",
  /** Outlined accent — a primary action that is not THE primary action on the page. */
  accentLine:
    "bg-transparent border-[var(--color-neon-orange)] text-[var(--color-primary)] font-medium " +
    "hover:text-[var(--color-neon-orange)]",
} as const;

const VARIANT_DISABLED = {
  primary:
    "bg-[#6a3a2f] border-[#6a3a2f] text-[#101010]/55 font-semibold cursor-not-allowed " +
    "hover:bg-[#6a3a2f] hover:border-[#6a3a2f] opacity-90",
  secondary:
    "bg-transparent border-white/15 text-[var(--color-primary)]/45 cursor-not-allowed " +
    "hover:border-white/15 opacity-70",
  accentLine:
    "bg-transparent border-[var(--color-neon-orange)]/35 text-[var(--color-primary)]/45 " +
    "font-medium cursor-not-allowed hover:text-[var(--color-primary)]/45 opacity-70",
} as const;

interface PricingButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof VARIANT;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit";
}

export function PricingButton({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  fullWidth = false,
}: PricingButtonProps) {
  const notched = variant === "primary" || variant === "accentLine";
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      style={notched ? NOTCH : undefined}
      className={[
        BASE,
        disabled ? VARIANT_DISABLED[variant] : VARIANT[variant],
        fullWidth ? "w-full" : "",
        disabled ? "" : "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

export default PricingButton;
