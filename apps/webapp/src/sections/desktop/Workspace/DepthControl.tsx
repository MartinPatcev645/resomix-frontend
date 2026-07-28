import React from "react";
import { useTrackCountOptions } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { LockNudge } from "@/components/Entitlements/LockNudge.tsx";
import { useEntitlementCta } from "@/utils/entitlementCta.ts";
import { WORKSPACE_FOCUS_VISIBLE } from "./workspacePanelStyles.ts";
import { DEPTH_LABEL } from "./workspaceCopy.ts";

export const DepthControl: React.FC = () => {
  const { topSk, setTopSk } = usePlayerStore();
  const { options, lockedCtaLabel, lockedCtaAction } = useTrackCountOptions();
  const { trigger: triggerEntitlementCta } = useEntitlementCta();

  return (
    <div className="flex flex-wrap items-center gap-[var(--px-8)]">
      <span
        id="workspace-depth-label"
        className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)]"
      >
        {DEPTH_LABEL}
      </span>
      <div
        className="flex overflow-hidden rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)]"
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
                WORKSPACE_FOCUS_VISIBLE,
                "relative min-h-[var(--px-44)] min-w-[var(--px-44)] px-[var(--px-10)] font-fira text-[length:var(--px-11)] tracking-[var(--px-1)] transition-[background-color,color,border-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
                index < options.length - 1 ? "border-r border-[var(--rx-color-border-subtle)]" : "",
                pressed
                  ? "border-[var(--rx-color-border-strong)] bg-[rgba(255,255,255,0.06)] text-[var(--rx-color-text-primary)]"
                  : "text-[var(--rx-color-text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--rx-color-text-primary)]",
                opt.locked ? "cursor-not-allowed text-[var(--rx-color-disabled)]" : "",
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
