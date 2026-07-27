/** Working panel chrome — matches preview.html `.panel` (solid border, panel2 fill, orange tick). */
export const WORKSPACE_PANEL_CLASS =
  "relative border border-[rgba(255,255,255,.14)] bg-[#101010] p-[var(--px-22)] before:absolute before:left-[var(--px-24)] before:top-0 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']";

/** Crossfade handoff between workspace stages — instant when reduced motion is preferred. */
export const WORKSPACE_STAGE_CLASS =
  "motion-safe:animate-[workspace-stage-in_200ms_ease-out_both]";

export const WORKSPACE_STAGE_MIN_H =
  "min-h-[var(--px-220)] motion-safe:transition-[min-height] motion-safe:duration-200";
