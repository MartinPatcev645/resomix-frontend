import React, { useEffect, useState } from "react";
import { useUploadStore } from "@resomix/hooks";
import {
  PROCESSING_NOTE,
  PROCESSING_STEPS_CATALOGUE,
  PROCESSING_STEPS_UPLOAD,
} from "./workspaceCopy.ts";

/**
 * Search: purely time-based cycle across all 3 steps; reaches the last by ~3.6 s (inside ~5–6 s).
 */
const CATALOGUE_SCHEDULE_MS = [0, 1800, 3600];

/**
 * Upload: step 0 ("Preparing reference") is NOT on a timer — it shows the real file-upload %. Once
 * the file has fully uploaded (progress === 100), the remaining steps cycle on this schedule
 * (offsets in ms from that moment), reaching the last step within ~9 s while the server
 * analyses/searches/builds. Offsets map to steps 1, 2, 3.
 */
const UPLOAD_POST_UPLOAD_SCHEDULE_MS = [0, 4000, 8000];

export const DiscoveryProcessingPanel: React.FC = () => {
  const { isFileUpload, progress } = useUploadStore();
  const steps = isFileUpload ? PROCESSING_STEPS_UPLOAD : PROCESSING_STEPS_CATALOGUE;
  const [activeIndex, setActiveIndex] = useState(0);

  // Search cycle — time-based across all steps. (Excludes `progress` so the 0→100 the search path
  // emits at completion can't reset the steps just before the panel unmounts.)
  useEffect(() => {
    if (isFileUpload) return;
    setActiveIndex(0);
    const timers = CATALOGUE_SCHEDULE_MS.slice(1).map((at, i) =>
      window.setTimeout(() => setActiveIndex(i + 1), at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isFileUpload]);

  // Upload cycle — the remaining steps only start once the file has fully uploaded (progress 100).
  useEffect(() => {
    if (!isFileUpload) return;
    if (progress < 100) {
      setActiveIndex(0); // stay on "Preparing reference" while its live % climbs
      return;
    }
    const timers = UPLOAD_POST_UPLOAD_SCHEDULE_MS.map((at, i) =>
      window.setTimeout(() => setActiveIndex(i + 1), at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [isFileUpload, progress]);

  const active = Math.min(steps.length - 1, activeIndex);

  return (
    <div
      className="py-[var(--px-8)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ol className="space-y-[var(--px-10)]">
        {steps.map((label, index) => {
          const state = index < active ? "done" : index === active ? "now" : "pending";
          // Upload's first step shows the live file-upload %: neon while active, and inheriting the
          // (dimmed) step colour once done so it matches the rest of that completed row.
          const showPercent = isFileUpload && index === 0;
          return (
            <li
              key={label}
              className={[
                "flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] tracking-[var(--px-1)]",
                state === "done" ? "opacity-70" : state === "now" ? "text-[var(--color-primary)]" : "opacity-40",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "block h-[var(--px-8)] w-[var(--px-8)] border",
                  state === "now"
                    ? "border-[var(--color-accent,#EE4A26)] bg-[var(--color-accent,#EE4A26)]"
                    : state === "done"
                      ? "border-slate-300 bg-slate-300"
                      : "border-slate-500",
                ].join(" ")}
              />
              {showPercent && (
                <span
                  aria-hidden="true"
                  className={[
                    "tabular-nums",
                    state === "now" ? "text-[var(--color-neon-orange,#EE4A26)]" : "",
                  ].join(" ")}
                >
                  {Math.min(100, Math.max(0, Math.round(progress)))}%
                </span>
              )}
              {label}
            </li>
          );
        })}
      </ol>
      <p className="mt-[var(--px-14)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] opacity-60">
        {PROCESSING_NOTE}
      </p>
    </div>
  );
};
