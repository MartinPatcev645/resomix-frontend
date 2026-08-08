import React, { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";
import {
  ANALYSIS_OUTPUT_LABEL,
  ANALYSIS_TASK_DESC,
  ANALYSIS_TASK_TITLE,
  DISCOVERY_OUTPUT_LABEL,
  DISCOVERY_TASK_DESC,
  DISCOVERY_TASK_TITLE,
  HOW_IT_WORKS_COLLAPSED_KEY,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TITLE,
  SELECT_TASK_LABEL,
  SELECTED_TASK_LABEL,
  TASK_GROUP_HEADING,
  TASK_GROUP_HINT,
  WORKSPACE_HEADING,
  WORKSPACE_SUBLINE,
} from "./workspaceCopy.ts";
import { UsageChip } from "@/components/Entitlements/UsageChip.tsx";
import { WorkspaceRail } from "./WorkspaceRail.tsx";
import { PAGE_MARK_INTERACTIVE } from "@resomix/ui";
import { WORKSPACE_FOCUS_VISIBLE } from "./workspacePanelStyles.ts";
import { isPlaylistUuid } from "@/utils/urlIdKind.ts";
import { withViewTransition } from "@/utils/viewTransition.ts";

export type WorkspaceMode = "discovery" | "analysis";

interface WorkspaceShellProps {
  mode: WorkspaceMode;
  children: React.ReactNode;
  /**
   * Replace the default two-card task block. When omitted, desktop markup is unchanged.
   * Mobile passes a segmented radiogroup — see `sections/mobile/Workspace/WorkspaceTaskSelector`.
   */
  taskSelector?: React.ReactNode;
  /**
   * Replace the header usage chip. `undefined` keeps `<UsageChip />`; pass `null` to hide
   * (mobile renders a searches-only counter inside its task selector instead).
   */
  usageChip?: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  mode,
  children,
  taskSelector,
  usageChip,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlId = searchParams.get("id");
  const viewingResults = mode === "discovery" && !!urlId && isPlaylistUuid(urlId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const sessionExpired = useAuthStore((s) => s.sessionExpired);
  const [guideCollapsed, setGuideCollapsed] = useState(false);
  const headingId = useId();
  const hintId = useId();
  const radioRefs = useRef<Partial<Record<WorkspaceMode, HTMLButtonElement | null>>>({});

  // Session badge — the dot carries the state as colour, so it reads at a glance without parsing
  // the label. Expired outranks the others: it is signed-out too, but "Guest session" would hide
  // the fact that something went wrong.
  const session = sessionExpired
    ? { label: "Session expired", dot: "bg-[var(--rx-color-error)]" }
    : isAuthenticated
      ? { label: "Signed in", dot: "bg-[var(--rx-color-success)]" }
      : { label: "Guest session", dot: "bg-[var(--rx-color-accent)]" };

  useEffect(() => {
    setGuideCollapsed(localStorage.getItem(HOW_IT_WORKS_COLLAPSED_KEY) === "true");
  }, []);

  const toggleGuide = () => {
    setGuideCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(HOW_IT_WORKS_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const selectTask = (next: WorkspaceMode) => {
    if (next === mode) return;
    withViewTransition(() => {
      // Tag this as a deliberate task switch so the destination panel does its smooth reveal-scroll.
      // A plain landing / redirect onto the page carries no such state, so the visitor stays at the
      // top (see WorkspaceStage). Navigation state (not a URL param) keeps the address clean and
      // auto-clears on refresh.
      navigate(next === "discovery" ? "/sonic-discovery" : "/analysis", {
        state: { workspaceModeSwitch: true },
      });
    });
  };

  // Keyboard semantics mirrored from mobile WorkspaceTaskSelector — duplicated rather than shared
  // so the mobile diff stays limited to the TASK_GROUP_HEADING copy substitution (§9).
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

  return (
    <div className="webapp-approved-container px-[var(--px-12)] pb-[var(--px-40)]">
      <header className="mb-[var(--px-28)] grid grid-cols-1 items-start gap-[var(--px-16)] sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-[var(--px-32)]">
        <div>
          <p className="mb-[var(--px-16)] flex items-center gap-[var(--px-10)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--color-primary)] opacity-75 before:block before:w-[var(--px-32)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']">
            Workspace // Production beta
          </p>
          <h1 className="font-benzin text-[length:var(--px-28)] uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            {WORKSPACE_HEADING}
          </h1>
          <p className="mt-[var(--px-12)] max-w-[40rem] text-[length:var(--px-17)] font-helvetica font-light leading-[var(--px-24)] opacity-70">
            {WORKSPACE_SUBLINE}
          </p>
        </div>
        {/* Right-aligned on every width, and pinned to the BOTTOM of the header's right column on
            sm+ (self-end) so it always sits directly above the task cards instead of riding up
            beside the heading, under the floating Catalogue-pilot / Feedback buttons. Single-column
            widths stack it under the subline, still right-aligned, on the header's own row gap. */}
        <div className="flex flex-wrap items-center gap-[var(--px-8)] justify-self-end sm:self-end">
          <span className="inline-flex items-center gap-[var(--px-8)] border border-[var(--rx-color-border-default)] px-[var(--px-13)] py-[var(--px-7)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
            <i
              aria-hidden="true"
              className={`block h-[var(--px-6)] w-[var(--px-6)] rounded-full not-italic ${session.dot}`}
            />
            {session.label}
          </span>
        </div>
      </header>

      {taskSelector ?? (
        <div className="mb-[var(--px-16)]">
          {/* Allowance sits on the task heading's row — directly above the cards it constrains.
              It used to live in the page header, which read correctly until TASK_GROUP_HEADING was
              added between the two: the chip then floated up beside the h1, far from anything it
              describes. Renders nothing when there is nothing true to say, and the heading keeps
              its position either way. */}
          <div className="flex flex-wrap items-end justify-between gap-[var(--px-12)]">
            <h2
              id={headingId}
              className="mt-[var(--px-4)] font-helvetica text-[length:var(--px-22)] font-bold leading-[var(--px-28)] text-[var(--rx-color-text-primary)]"
            >
              {TASK_GROUP_HEADING}
            </h2>
            {usageChip === undefined ? <UsageChip /> : usageChip}
          </div>
          <p
            id={hintId}
            className="mt-[var(--px-6)] mb-[var(--px-16)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-secondary)]"
          >
            {TASK_GROUP_HINT}
          </p>
          <div
            className="grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-2 sm:gap-[var(--px-16)] sm:items-stretch"
            role="radiogroup"
            aria-labelledby={headingId}
            aria-describedby={hintId}
          >
            <TaskCard
              pressed={mode === "discovery"}
              title={DISCOVERY_TASK_TITLE}
              description={DISCOVERY_TASK_DESC}
              outputLabel={DISCOVERY_OUTPUT_LABEL}
              icon={<DiscoveryModeIcon />}
              onClick={() => moveTo("discovery")}
              onKeyDown={(event) => onRadioKeyDown(event, "discovery")}
              radioRef={(el) => {
                radioRefs.current.discovery = el;
              }}
            />
            <TaskCard
              pressed={mode === "analysis"}
              title={ANALYSIS_TASK_TITLE}
              description={ANALYSIS_TASK_DESC}
              outputLabel={ANALYSIS_OUTPUT_LABEL}
              icon={<AnalysisModeIcon />}
              onClick={() => moveTo("analysis")}
              onKeyDown={(event) => onRadioKeyDown(event, "analysis")}
              radioRef={(el) => {
                radioRefs.current.analysis = el;
              }}
            />
          </div>
        </div>
      )}

      {/* Guide + workspace share a flex column purely so the guide can drop below the panel on
          mobile via `order`, rather than being rendered twice. `lg` because `useResponsive` uses
          `(min-width: 1024px)` and that file warns the two must not disagree. */}
      <div className="flex flex-col">
      {mode === "discovery" && !viewingResults && (
        <div className="order-2 mt-[var(--px-20)] border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] lg:order-1 lg:mt-0 lg:mb-[var(--px-20)]">
          <button
            type="button"
            className={`flex w-full min-h-[var(--px-44)] items-center justify-between gap-[var(--px-16)] px-[var(--px-20)] py-[var(--px-13)] text-left ${WORKSPACE_FOCUS_VISIBLE}`}
            aria-expanded={!guideCollapsed}
            aria-controls="workspace-how-it-works"
            onClick={toggleGuide}
          >
            <span className="font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-primary)]">
              {HOW_IT_WORKS_TITLE}
            </span>
            <span aria-hidden="true" className="font-fira text-[length:var(--px-14)] text-[var(--rx-color-text-muted)]">
              {guideCollapsed ? "+" : "−"}
            </span>
          </button>
          {!guideCollapsed && (
            <ol
              id="workspace-how-it-works"
              className="grid gap-[var(--px-10)] border-t border-[var(--rx-color-border-subtle)] px-[var(--px-20)] pb-[var(--px-10)] pt-[var(--px-10)] sm:grid-cols-3 sm:gap-[var(--px-32)] items-center"
            >
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <li key={step} className="flex items-baseline gap-[var(--px-10)]">
                  <span
                    aria-hidden="true"
                    className="shrink-0 rounded-[var(--rx-radius-tag)] border border-[var(--rx-color-border-default)] px-[var(--px-6)] py-[var(--px-1)] font-fira text-[length:var(--px-11)] font-medium text-[var(--rx-color-text-secondary)]"
                  >
                    {index + 1}
                  </span>
                  <span className="text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-22)] text-[var(--rx-color-text-secondary)]">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div
        className={[
          "order-1 grid grid-cols-1 gap-[var(--px-24)] lg:order-2",
          isAuthenticated ? "lg:[grid-template-columns:minmax(0,1fr)_16rem]" : "",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[60rem] lg:mx-0 lg:max-w-none">{children}</div>
        {isAuthenticated && <WorkspaceRail mode={mode} />}
      </div>
      </div>
    </div>
  );
};

const TaskCard: React.FC<{
  pressed: boolean;
  title: string;
  description: string;
  outputLabel: string;
  icon: React.ReactNode;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  radioRef: (el: HTMLButtonElement | null) => void;
}> = ({ pressed, title, description, outputLabel, icon, onClick, onKeyDown, radioRef }) => {
  const [outPrefix, outValue] = splitOutputLabel(outputLabel);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={pressed}
      tabIndex={pressed ? 0 : -1}
      ref={radioRef}
      onClick={onClick}
      onKeyDown={onKeyDown}
      className={[
        "ws-transition flex h-full min-h-[var(--px-120)] flex-col gap-[var(--px-12)] border p-[var(--px-17)] pb-[var(--px-16)] text-left transition-[border-color,background-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)] sm:p-[var(--px-20)] sm:pb-[var(--px-16)]",
        // The whole card is a button, so it carries the full-weight top-left mark — on BOTH cards,
        // because the mark says "operable", not "chosen". Selection is carried by the accent
        // border, selected fill, radio mark, and SELECTED label.
        PAGE_MARK_INTERACTIVE,
        WORKSPACE_FOCUS_VISIBLE,
        pressed
          ? "ws-mode-card-selected cursor-default border-[var(--rx-color-accent)] bg-[var(--rx-color-selected)]"
          : "cursor-pointer border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.035)]",
      ].join(" ")}
    >
      {/* Row 1 — control header: radio · icon · title · state label */}
      <span className="flex min-w-0 items-center gap-[var(--px-12)]">
        <RadioMark checked={pressed} />
        <span
          aria-hidden="true"
          className={[
            "flex h-[var(--px-32)] w-[var(--px-32)] shrink-0 items-center justify-center border transition-colors duration-[var(--rx-duration-base)]",
            pressed
              ? "border-[var(--rx-color-accent)] text-[var(--rx-color-accent)]"
              : "border-[var(--rx-color-border-default)] text-[var(--rx-color-text-muted)]",
          ].join(" ")}
        >
          <span className="block h-[var(--px-18)] w-[var(--px-18)]">{icon}</span>
        </span>
        <span className="min-w-0 flex-1 font-helvetica text-[length:var(--px-16)] font-bold uppercase leading-[var(--px-20)] tracking-[0.03em] text-[var(--rx-color-text-primary)]">
          {title}
        </span>
        {pressed ? (
          <span
            aria-hidden="true"
            className="inline-flex shrink-0 items-center gap-[var(--px-6)] border border-[rgba(238,74,38,0.55)] bg-[var(--rx-color-accent-soft)] px-[var(--px-8)] py-[var(--px-2)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-accent)]"
          >
            <i aria-hidden="true" className="not-italic">
              ●
            </i>
            {SELECTED_TASK_LABEL}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className="shrink-0 font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]"
          >
            {SELECT_TASK_LABEL}
          </span>
        )}
      </span>

      {/* Row 2 — description, full card width */}
      <span className="block flex-1 text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-20)] text-[var(--rx-color-text-secondary)]">
        {description}
      </span>

      {/* Row 3 — output */}
      <span className="mt-auto flex flex-wrap items-baseline gap-x-[var(--px-16)] gap-y-[var(--px-6)] border-t border-[var(--rx-color-border-subtle)] pt-[var(--px-9)]">
        <span className="font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-secondary)]">
          <span className="font-medium text-[var(--rx-color-text-secondary)]">{outPrefix}</span>{" "}
          <span className="text-[rgba(238,74,38,.7)]">//</span> {outValue}
        </span>
      </span>
    </button>
  );
};

const RadioMark: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={[
      "flex h-[var(--px-16)] w-[var(--px-16)] shrink-0 items-center justify-center rounded-full border-[1.5px]",
      checked
        ? "border-[var(--rx-color-accent)] bg-transparent"
        : "border-[var(--rx-color-text-muted)] bg-transparent",
    ].join(" ")}
  >
    {checked ? (
      <span className="block h-[var(--px-8)] w-[var(--px-8)] rounded-full bg-[var(--rx-color-accent)]" />
    ) : null}
  </span>
);

function splitOutputLabel(label: string): [string, string] {
  const idx = label.indexOf("//");
  if (idx === -1) return [label, ""];
  return [label.slice(0, idx).trim(), label.slice(idx + 2).trim()];
}

const DiscoveryModeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-full w-full" aria-hidden="true">
    <path d="M3 12 l3-3 2.5 5 3-8 2.5 6 2-3" />
    <circle cx="19.5" cy="14.5" r="2.4" />
    <path d="M19.5 12.1 V8" />
  </svg>
);

const AnalysisModeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-full w-full" aria-hidden="true">
    <rect x="3" y="4" width="18" height="14" rx="1" />
    <path d="M7 14 V10 M11 14 V8 M15 14 V11" />
  </svg>
);
