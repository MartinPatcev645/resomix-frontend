/** Working panel chrome — matches preview.html `.console` (solid border, panel fill, orange tick, primacy shadow). */
export const WORKSPACE_PANEL_CLASS =
  "relative overflow-hidden border border-[rgba(255,255,255,.16)] bg-[#101010] p-[var(--px-22)] shadow-[0_1.75rem_4rem_rgba(0,0,0,.45)] before:absolute before:left-[var(--px-24)] before:top-0 before:z-10 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-[''] after:pointer-events-none after:absolute after:left-0 after:top-[35%] after:z-0 after:h-[60%] after:w-[55%] after:bg-[radial-gradient(28rem_12rem_at_30%_60%,rgba(238,74,38,.07),transparent_65%)] after:content-['']";

/** Crossfade handoff between workspace stages — instant when reduced motion is preferred. */
export const WORKSPACE_STAGE_CLASS =
  "motion-safe:animate-[workspace-stage-in_200ms_ease-out_both]";

/** Enough height to avoid jump between search/upload/reference stages — not a forced viewport fill. */
export const WORKSPACE_STAGE_MIN_H =
  "relative z-20 min-h-[var(--px-180)] motion-safe:transition-[min-height] motion-safe:duration-200";
