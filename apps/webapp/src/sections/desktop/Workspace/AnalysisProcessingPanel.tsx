import React, { useEffect, useState } from "react";
import type { AnalysisStatus } from "@/pages/analysis/useTrackAnalysis.ts";
import {
  ANALYSIS_PROCESSING_NOTE,
  ANALYSIS_PROCESSING_STEPS,
  ANALYSIS_UPLOAD_STEP,
} from "./workspaceCopy.ts";
import { useLastStepBlink } from "./useLastStepBlink.ts";

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

  /**
   * The upload step ends when the last BYTE is sent, not when the POST resolves. `status` only
   * flips to "analyzing" once the server has taken the file and answered with an analysis id — so
   * gating on status alone left this pinned at "Uploading track — 100%" for that whole round trip,
   * which read as a slow upload. That wait is the server accepting and enqueuing the job, which is
   * precisely what the next step ("Queued") describes.
   */
  const uploadDone = status !== "uploading" || progress >= 100;

  useEffect(() => {
    // Step 0 ("Uploading track") is gated on the real upload %.
    if (!uploadDone) {
      setActiveIndex(0);
      return;
    }
    // Bytes are in → move onto the analysis steps immediately, then cycle across ~22 s.
    setActiveIndex(1);
    const timers = ANALYSIS_STEP_SCHEDULE_MS.map((at, i) =>
      window.setTimeout(() => setActiveIndex(i + 2), at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [uploadDone]);

  const active = Math.min(steps.length - 1, activeIndex);
  // The last step ("Completed") holds while the async job finishes — blink its dot after 3s so it
  // doesn't read as frozen.
  const blinkLast = useLastStepBlink(active === steps.length - 1);
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
          const isLast = index === steps.length - 1;
          const showPercent = index === 0; // the upload-% step
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
                    ? "border-[var(--color-accent,#EE4A26)] bg-[var(--color-accent,#EE4A26)]"
                    : state === "done"
                      ? "border-slate-300 bg-slate-300"
                      : "border-slate-500",
                  state === "now" && isLast && blinkLast
                    ? "motion-safe:animate-[sd-pulse_2.6s_ease-in-out_infinite]"
                    : "",
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
