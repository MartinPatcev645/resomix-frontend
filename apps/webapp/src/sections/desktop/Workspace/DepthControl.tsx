import React from "react";
import { useTrackCountOptions } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { LockNudge } from "@/components/Entitlements/LockNudge.tsx";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";
import { DEPTH_LABEL } from "./workspaceCopy.ts";

export const DepthControl: React.FC = () => {
  const { topSk, setTopSk } = usePlayerStore();
  const { options, lockedCtaLabel, lockedCtaAction } = useTrackCountOptions();
  const { trigger: triggerEntitlementCta } = useEntitlementCta();

  return (
    <div className="flex flex-wrap items-center gap-[var(--px-8)]">
      <span
        id="workspace-depth-label"
        className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] opacity-50"
      >
        {DEPTH_LABEL}
      </span>
      <div
        className="flex border border-dotted border-slate-400"
        role="group"
        aria-labelledby="workspace-depth-label"
      >
        {options.map((opt, index) => {
          const pressed = topSk === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={pressed}
              disabled={opt.locked}
              title={opt.locked ? opt.label : undefined}
              onClick={() => !opt.locked && setTopSk(opt.value)}
              className={[
                "relative min-h-[var(--px-44)] min-w-[var(--px-44)] px-[var(--px-10)] font-fira text-[length:var(--px-11)] tracking-[var(--px-1)] transition-colors",
                index < options.length - 1 ? "border-r border-dotted border-slate-400" : "",
                pressed
                  ? "bg-[rgba(255,255,255,.08)] text-[var(--color-primary)]"
                  : "text-[var(--color-primary)] opacity-70 hover:opacity-100",
                opt.locked ? "cursor-not-allowed opacity-40" : "",
              ].join(" ")}
            >
              {opt.value}
              {opt.locked && (
                <span aria-hidden="true" className="ml-[var(--px-2)] text-[length:var(--px-10)]">
                  ⌾
                </span>
              )}
            </button>
          );
        })}
      </div>
      {lockedCtaLabel && lockedCtaAction && (
        <LockNudge label={lockedCtaLabel} onClick={() => triggerEntitlementCta(lockedCtaAction)} />
      )}
    </div>
  );
};
