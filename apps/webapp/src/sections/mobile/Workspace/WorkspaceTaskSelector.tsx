import React, { useId, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { UsageChip } from "@/components/Entitlements/UsageChip.tsx";
import {
  ANALYSIS_OUTPUT_LABEL,
  ANALYSIS_TASK_DESC,
  ANALYSIS_TASK_TITLE,
  DISCOVERY_OUTPUT_LABEL,
  DISCOVERY_TASK_DESC,
  DISCOVERY_TASK_TITLE,
  TASK_GROUP_HEADING,
} from "../../desktop/Workspace/workspaceCopy.ts";
import { WORKSPACE_FOCUS_VISIBLE } from "../../desktop/Workspace/workspacePanelStyles.ts";
import type { WorkspaceMode } from "../../desktop/Workspace/WorkspaceShell.tsx";
import { withViewTransition } from "@/utils/viewTransition.ts";

const OPTIONS: ReadonlyArray<{
  mode: WorkspaceMode;
  title: string;
  description: string;
  outputLabel: string;
}> = [
  {
    mode: "discovery",
    title: DISCOVERY_TASK_TITLE,
    description: DISCOVERY_TASK_DESC,
    outputLabel: DISCOVERY_OUTPUT_LABEL,
  },
  {
    mode: "analysis",
    title: ANALYSIS_TASK_TITLE,
    description: ANALYSIS_TASK_DESC,
    outputLabel: ANALYSIS_OUTPUT_LABEL,
  },
];

/**
 * Mobile task choice — two-up radiogroup so the modes read as mutually exclusive, not a sequence.
 * Desktop keeps the stacked/side-by-side TaskCards in WorkspaceShell.
 */
export const WorkspaceTaskSelector: React.FC<{ mode: WorkspaceMode }> = ({ mode }) => {
  const navigate = useNavigate();
  const labelId = useId();
  const radioRefs = useRef<Partial<Record<WorkspaceMode, HTMLButtonElement | null>>>({});

  const selectTask = (next: WorkspaceMode) => {
    if (next === mode) return;
    withViewTransition(() => {
      navigate(next === "discovery" ? "/sonic-discovery" : "/track-intelligence", {
        state: { workspaceModeSwitch: true },
      });
    });
  };

  const focusMode = (next: WorkspaceMode) => {
    radioRefs.current[next]?.focus();
  };

  const moveTo = (next: WorkspaceMode) => {
    selectTask(next);
    // Focus follows selection even when already on that mode (arrow onto the active radio).
    requestAnimationFrame(() => focusMode(next));
  };

  const onRadioKeyDown = (event: React.KeyboardEvent, current: WorkspaceMode) => {
    const other: WorkspaceMode = current === "discovery" ? "analysis" : "discovery";
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveTo(other);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveTo(other);
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      moveTo(current);
    }
  };

  const selected = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0];
  const [outPrefix, outValue] = splitOutputLabel(selected.outputLabel);

  return (
    <div className="mb-[var(--px-16)]">
      {/* Same multi-metric chip as desktop. It used to be a searches-only line here, which meant
          uploads, exports and the Library cap were invisible on mobile — the three allowances a
          user is most likely to hit without warning. Full width, since there is no room beside the
          heading at this size. */}
      <UsageChip className="mb-[var(--px-12)] w-full" />

      <p
        id={labelId}
        className="mb-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]"
      >
        {TASK_GROUP_HEADING}
      </p>

      <div className="border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)]">
        <div
          role="radiogroup"
          aria-labelledby={labelId}
          className="grid grid-cols-2"
        >
          {OPTIONS.map((option, index) => {
            const checked = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={checked ? 0 : -1}
                ref={(el) => {
                  radioRefs.current[option.mode] = el;
                }}
                onClick={() => moveTo(option.mode)}
                onKeyDown={(event) => onRadioKeyDown(event, option.mode)}
                className={[
                  WORKSPACE_FOCUS_VISIBLE,
                  "flex min-h-[var(--px-64)] flex-col items-center justify-center gap-[var(--px-8)] px-[var(--px-10)] py-[var(--px-12)] text-center",
                  index === 0 ? "border-r border-[var(--rx-color-border-default)]" : "",
                  checked
                    ? "bg-[rgba(238,74,38,.08)] shadow-[inset_0_-2px_0_0_var(--rx-color-accent)]"
                    : "bg-transparent",
                ].join(" ")}
              >
                <RadioMark checked={checked} />
                <span
                  className={[
                    "font-fira text-[length:var(--px-13)] uppercase tracking-[var(--px-1)] leading-[var(--px-16)]",
                    checked
                      ? "text-[var(--rx-color-text-primary)]"
                      : "text-[var(--rx-color-text-muted)]",
                  ].join(" ")}
                >
                  {option.title}
                </span>
              </button>
            );
          })}
        </div>

        <div
          aria-live="polite"
          className="border-t border-[var(--rx-color-border-subtle)] px-[var(--px-16)] py-[var(--px-14)]"
        >
          <p className="text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]">
            {selected.description}
          </p>
          <p className="mt-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
            <span className="font-medium text-[var(--rx-color-text-secondary)]">{outPrefix}</span>{" "}
            <span className="text-[rgba(238,74,38,.7)]">//</span> {outValue}
          </p>
        </div>
      </div>
    </div>
  );
};

const RadioMark: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={[
      "block h-[var(--px-14)] w-[var(--px-14)] shrink-0 rounded-full border-[1.5px]",
      checked
        ? "border-[var(--rx-color-accent)] bg-[var(--rx-color-accent)]"
        : "border-[var(--rx-color-text-muted)] bg-transparent",
    ].join(" ")}
  />
);



function splitOutputLabel(label: string): [string, string] {
  const idx = label.indexOf("//");
  if (idx === -1) return [label, ""];
  return [label.slice(0, idx).trim(), label.slice(idx + 2).trim()];
}
