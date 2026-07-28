import React, { useEffect, useState } from "react";
import type { AnalysisStatus } from "@/pages/analysis/useTrackAnalysis.ts";
import {
  ANALYSIS_PROCESSING_NOTE,
  ANALYSIS_PROCESSING_STEPS,
  ANALYSIS_UPLOAD_STEP,
} from "./workspaceCopy.ts";

/**
 * Once the file has finished uploading (status → "analyzing"), cycle the three analysis steps over
 * the ~22 s an analysis averages. Offsets (ms) are from the moment analysis begins; the last step is
 * reached at ~15 s and holds, absorbing any extra time. Maps to steps 1, 2, 3 (step 0 is the
 * upload-% step, which is driven by real progress, not this timer).
 */
const ANALYSIS_STEP_SCHEDULE_MS = [7500, 15000]; // for steps 2 and 3 (step 1 starts immediately)

interface AnalysisProcessingPanelProps {
  status: AnalysisStatus;
  progress: number;
  fileName?: string | null;
}

export const AnalysisProcessingPanel: React.FC<AnalysisProcessingPanelProps> = ({
  status,
  progress,
  fileName,
}) => {
  const steps = [ANALYSIS_UPLOAD_STEP, ...ANALYSIS_PROCESSING_STEPS];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // Step 0 ("Uploading file") is gated on the real upload %.
    if (status === "uploading") {
      setActiveIndex(0);
      return;
    }
    // Upload done → move onto the analysis steps immediately, then cycle across ~22 s.
    setActiveIndex(1);
    const timers = ANALYSIS_STEP_SCHEDULE_MS.map((at, i) =>
      window.setTimeout(() => setActiveIndex(i + 2), at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [status]);

  const active = Math.min(steps.length - 1, activeIndex);
  // Upload-% counter: climbs with the real byte progress while uploading, then pinned at 100%.
  const uploadPct = status === "uploading" ? Math.min(100, Math.max(0, Math.round(progress))) : 100;

  return (
    <div
      className="py-[var(--px-8)]"
      role="status"
      aria-live="polite"
      aria-busy={active < steps.length - 1}
    >
      {fileName && (
        <p className="mb-[var(--px-14)] truncate font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] opacity-70">
          {fileName}
        </p>
      )}
      <ol className="space-y-[var(--px-10)]">
        {steps.map((label, index) => {
          const state = index < active ? "done" : index === active ? "now" : "pending";
          const showPercent = index === 0; // the "Uploading file" step
          return (
            <li
              key={label}
              className={[
                "flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-12)] tracking-[var(--px-1)]",
                state === "done" ? "opacity-70" : state === "now" ? "text-[var(--color-primary)]" : "opacity-40",
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={[
                  "block h-[var(--px-8)] w-[var(--px-8)] rounded-[var(--rx-radius-control)] border",
                  state === "now"
                    ? "border-[var(--color-accent,#EE4A26)] bg-[var(--color-accent,#EE4A26)] motion-safe:animate-pulse"
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
                  {uploadPct}%
                </span>
              )}
              {label}
            </li>
          );
        })}
      </ol>
      <p className="mt-[var(--px-14)] text-[length:var(--px-12)] font-helvetica font-light leading-[var(--px-18)] opacity-60">
        {ANALYSIS_PROCESSING_NOTE}
      </p>
    </div>
  );
};
