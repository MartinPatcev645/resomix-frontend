import React from "react";

/**
 * LockNudge — a small, properly aligned lock-icon + text nudge used wherever an entitlement caps
 * the UI (dropdown depth, teased results, gated actions). Icon and text are vertically centered
 * via flex so they always line up regardless of font scaling (the --px-* system).
 */
export interface LockNudgeProps {
  label: string;
  onClick?: () => void;
  /** Extra classes for spacing/placement at the call site. */
  className?: string;
  /** Icon + text size token (defaults suit the compact dropdown helper line). */
  size?: "sm" | "md";
}

const LockGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const LockNudge: React.FC<LockNudgeProps> = ({ label, onClick, className = "", size = "sm" }) => {
  const iconCls = size === "sm" ? "w-[var(--px-10)] h-[var(--px-10)]" : "w-[var(--px-13)] h-[var(--px-13)]";
  const textCls = size === "sm" ? "text-[length:var(--px-9)]" : "text-[length:var(--px-11)]";
  const interactive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-label={label}
      className={`inline-flex items-center gap-[var(--px-4)] leading-none opacity-70 transition-opacity ${
        interactive ? "hover:opacity-100 cursor-pointer" : "cursor-default"
      } ${className}`}
    >
      <LockGlyph className={`${iconCls} shrink-0`} />
      <span className={`${textCls} font-fira font-light`}>{label}</span>
    </button>
  );
};

export default LockNudge;
