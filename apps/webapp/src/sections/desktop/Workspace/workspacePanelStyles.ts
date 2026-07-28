/** Working panel chrome — precision-industrial surface (radius 0, token borders). */
export const WORKSPACE_PANEL_CLASS =
  "relative overflow-hidden border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] p-[var(--px-22)] before:absolute before:left-[var(--px-24)] before:top-0 before:z-10 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--rx-color-accent)] before:content-[''] motion-safe:animate-[workspace-panel-in_150ms_ease-out_both]";

/** Panel / stage entry — 150ms opacity fade only; instant when reduced motion is preferred. */
export const WORKSPACE_STAGE_CLASS =
  "motion-safe:animate-[workspace-panel-in_150ms_ease-out_both]";

/** Enough height to avoid jump between search/upload/reference stages — not a forced viewport fill. */
export const WORKSPACE_STAGE_MIN_H =
  "relative z-20 min-h-[var(--px-180)] motion-safe:transition-[min-height] motion-safe:duration-200";

/** Phase 1B focus ring — rectangular, never outline-only. */
export const WORKSPACE_FOCUS_VISIBLE = "ws-focus-ring";

/** Primary CTA — single accent per context; chamfer drops on focus-visible. */
export const WORKSPACE_BTN_PRIMARY = [
  "ws-btn-primary ws-focus-ring",
  "inline-flex min-h-[var(--px-44)] items-center justify-center",
  "rounded-[var(--rx-radius-control)] border border-[var(--rx-color-accent)]",
  "bg-[var(--rx-color-accent)] px-[var(--px-22)]",
  "font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-1)] text-[#050505]",
  "transition-[background-color,border-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
  "hover:border-[var(--rx-color-accent-hover)] hover:bg-[var(--rx-color-accent-hover)]",
  "disabled:cursor-not-allowed disabled:border-[rgba(255,255,255,0.12)] disabled:bg-[rgba(255,255,255,0.03)] disabled:text-[var(--rx-color-disabled)]",
].join(" ");

/** Secondary control — transparent, bordered hardware block. */
export const WORKSPACE_BTN_SECONDARY = [
  "ws-focus-ring",
  "inline-flex min-h-[var(--px-44)] items-center justify-center",
  "rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] bg-transparent",
  "px-[var(--px-16)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)]",
  "text-[var(--rx-color-text-primary)]",
  "transition-[background-color,border-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
  "hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)]",
  "disabled:cursor-not-allowed disabled:border-[rgba(255,255,255,0.12)] disabled:bg-[rgba(255,255,255,0.03)] disabled:text-[var(--rx-color-disabled)]",
].join(" ");

/** Badge chip — mono uppercase tag (ACTIVE TASK, catalogue/upload). */
export const WORKSPACE_BADGE = [
  "inline-flex min-h-[var(--px-24)] items-center",
  "rounded-[var(--rx-radius-tag)] border border-[var(--rx-color-border-default)]",
  "bg-[rgba(255,255,255,0.03)] px-[var(--px-8)]",
  "font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)]",
  "text-[var(--rx-color-text-primary)]",
].join(" ");

/** Accent-tone badge (ACTIVE TASK). */
export const WORKSPACE_BADGE_ACCENT = [
  WORKSPACE_BADGE,
  "border-[rgba(238,74,38,0.55)] bg-[var(--rx-color-accent-soft)]",
].join(" ");

/** Search / select field shell. */
export const WORKSPACE_FIELD_CLASS = [
  "min-h-[var(--px-44)] w-full rounded-[var(--rx-radius-control)]",
  "border border-[var(--rx-color-border-default)] bg-[#0a0a0a]",
  "text-[var(--rx-color-text-primary)]",
  "transition-[border-color,box-shadow] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
  "hover:border-[var(--rx-color-border-strong)]",
  "focus:border-[var(--rx-color-border-default)] focus:outline-none",
  "focus-visible:shadow-[var(--rx-ring)]",
].join(" ");
