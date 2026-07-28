import { useEffect, useState } from "react";

/** Delay before showing the skeleton — fast chunk loads stay blank (shell already visible). */
const SKELETON_DELAY_MS = 200;

/**
 * Suspense fallback for lazy routes. Renders nothing for ~200ms, then a quiet
 * panel-shaped placeholder. The WebLayout shell (nav / noise / sidelines) stays
 * mounted around this; no spinner, no copy.
 */
export function RouteFallback() {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShowSkeleton(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (!showSkeleton) return null;

  return (
    <div
      aria-hidden="true"
      className="webapp-approved-container px-[var(--px-32)] pb-[var(--px-40)] pt-[var(--px-28)]"
    >
      <div
        className={[
          "min-h-[var(--px-180)] border border-[rgba(255,255,255,.16)] bg-[#101010]",
          "before:absolute before:left-[var(--px-24)] before:top-0 before:block before:w-[var(--px-28)]",
          "before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']",
          "relative overflow-hidden",
          "motion-safe:animate-[workspace-panel-in_150ms_ease-out_both]",
        ].join(" ")}
      >
        <div className="flex flex-col gap-[var(--px-16)] p-[var(--px-22)]">
          <div className="h-[var(--px-12)] w-[40%] bg-[rgba(255,255,255,.06)]" />
          <div className="h-[var(--px-12)] w-[70%] bg-[rgba(255,255,255,.04)]" />
          <div className="mt-[var(--px-8)] h-[var(--px-88)] w-full bg-[rgba(255,255,255,.03)]" />
        </div>
      </div>
    </div>
  );
}

export default RouteFallback;
