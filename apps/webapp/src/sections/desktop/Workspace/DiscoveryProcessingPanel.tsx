import React from "react";
import { useUploadStore } from "@resomix/hooks";
import {
  PROCESSING_NOTE,
  PROCESSING_STEPS_CATALOGUE,
  PROCESSING_STEPS_UPLOAD,
} from "./workspaceCopy.ts";

export const DiscoveryProcessingPanel: React.FC = () => {
  const { progress, isFileUpload } = useUploadStore();
  const steps = isFileUpload ? PROCESSING_STEPS_UPLOAD : PROCESSING_STEPS_CATALOGUE;
  const activeIndex = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));

  return (
    <div
      className="py-[var(--px-8)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <ol className="space-y-[var(--px-10)]">
        {steps.map((label, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "now" : "pending";
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
