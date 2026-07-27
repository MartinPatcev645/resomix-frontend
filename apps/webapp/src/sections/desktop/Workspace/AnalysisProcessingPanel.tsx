import React from "react";
import {
  ANALYSIS_PROCESSING_NOTE,
  ANALYSIS_PROCESSING_STEPS,
} from "./workspaceCopy.ts";

interface AnalysisProcessingPanelProps {
  /** 0 = Queued, 1 = Processing, 2 = Completed */
  activeStep: number;
  fileName?: string | null;
}

export const AnalysisProcessingPanel: React.FC<AnalysisProcessingPanelProps> = ({
  activeStep,
  fileName,
}) => (
  <div
    className="py-[var(--px-8)]"
    role="status"
    aria-live="polite"
    aria-busy={activeStep < 2}
  >
    {fileName && (
      <p className="mb-[var(--px-14)] truncate font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] opacity-70">
        {fileName}
      </p>
    )}
    <ol className="space-y-[var(--px-10)]">
      {ANALYSIS_PROCESSING_STEPS.map((label, index) => {
        const state =
          index < activeStep ? "done" : index === activeStep ? "now" : "pending";
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
                "block h-[var(--px-8)] w-[var(--px-8)] rounded-full border",
                state === "now"
                  ? "border-[var(--color-accent,#EE4A26)] bg-[var(--color-accent,#EE4A26)] motion-safe:animate-pulse"
                  : state === "done"
                    ? "border-slate-300 bg-slate-300"
                    : "border-slate-500",
              ].join(" ")}
            />
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
