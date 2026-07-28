import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";
import {
  ACTIVE_TASK_LABEL,
  ANALYSIS_OUTPUT_LABEL,
  ANALYSIS_TASK_DESC,
  ANALYSIS_TASK_TITLE,
  DISCOVERY_OUTPUT_LABEL,
  DISCOVERY_TASK_DESC,
  DISCOVERY_TASK_TITLE,
  HOW_IT_WORKS_COLLAPSED_KEY,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_TITLE,
  SWITCH_TO_ANALYSIS,
  SWITCH_TO_DISCOVERY,
  WORKSPACE_HEADING,
  WORKSPACE_SUBLINE,
} from "./workspaceCopy.ts";
import { WorkspaceRail } from "./WorkspaceRail.tsx";
import { isPlaylistUuid } from "@/utils/urlIdKind.ts";

export type WorkspaceMode = "discovery" | "analysis";

interface WorkspaceShellProps {
  mode: WorkspaceMode;
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ mode, children }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlId = searchParams.get("id");
  const viewingResults = mode === "discovery" && !!urlId && isPlaylistUuid(urlId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [guideCollapsed, setGuideCollapsed] = useState(false);

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
    navigate(next === "discovery" ? "/sonic-discovery" : "/analysis");
  };

  return (
    <div className="webapp-approved-container px-[var(--px-32)] pb-[var(--px-40)]">
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
        <span className="mt-[var(--px-2)] inline-flex items-center gap-[var(--px-8)] justify-self-start border border-dotted border-[rgba(255,255,255,.16)] px-[var(--px-13)] py-[var(--px-7)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60 sm:justify-self-end">
          <i
            aria-hidden="true"
            className="block h-[var(--px-6)] w-[var(--px-6)] rounded-full bg-[rgba(255,255,255,.45)] not-italic"
          />
          {isAuthenticated ? "Signed in" : "Guest session"}
        </span>
      </header>

      <div
        className="mb-[var(--px-16)] grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-2 sm:gap-[var(--px-16)]"
        role="group"
        aria-label="Choose your task"
      >
        <TaskCard
          pressed={mode === "discovery"}
          title={DISCOVERY_TASK_TITLE}
          description={DISCOVERY_TASK_DESC}
          outputLabel={DISCOVERY_OUTPUT_LABEL}
          switchCue={SWITCH_TO_DISCOVERY}
          icon={<DiscoveryModeIcon />}
          onClick={() => selectTask("discovery")}
        />
        <TaskCard
          pressed={mode === "analysis"}
          title={ANALYSIS_TASK_TITLE}
          description={ANALYSIS_TASK_DESC}
          outputLabel={ANALYSIS_OUTPUT_LABEL}
          switchCue={SWITCH_TO_ANALYSIS}
          icon={<AnalysisModeIcon />}
          onClick={() => selectTask("analysis")}
        />
      </div>

      {mode === "discovery" && !viewingResults && (
        <div className="mb-[var(--px-20)] border border-[rgba(255,255,255,.09)] bg-[rgba(255,255,255,.015)]">
          <button
            type="button"
            className="flex w-full min-h-[var(--px-44)] items-center justify-between gap-[var(--px-16)] px-[var(--px-20)] py-[var(--px-13)] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
            aria-expanded={!guideCollapsed}
            aria-controls="workspace-how-it-works"
            onClick={toggleGuide}
          >
            <span className="font-fira text-[length:var(--px-12)] uppercase tracking-[var(--px-2)] text-[var(--color-primary)] opacity-80">
              {HOW_IT_WORKS_TITLE}
            </span>
            <span aria-hidden="true" className="font-fira text-[length:var(--px-14)] text-[var(--color-primary)] opacity-55">
              {guideCollapsed ? "+" : "−"}
            </span>
          </button>
          {!guideCollapsed && (
            <ol
              id="workspace-how-it-works"
              className="grid gap-[var(--px-10)] border-t border-dotted border-[rgba(255,255,255,.09)] px-[var(--px-20)] pb-[var(--px-17)] pt-[var(--px-4)] sm:grid-cols-3 sm:gap-[var(--px-32)]"
            >
              {HOW_IT_WORKS_STEPS.map((step, index) => (
                <li key={step} className="flex items-baseline gap-[var(--px-10)]">
                  <span
                    aria-hidden="true"
                    className="shrink-0 border border-[rgba(238,74,38,.4)] px-[var(--px-6)] py-[var(--px-1)] font-fira text-[length:var(--px-11)] font-medium text-[var(--color-accent,#EE4A26)]"
                  >
                    {index + 1}
                  </span>
                  <span className="text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-22)] text-[var(--color-primary)] opacity-75">
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
          "grid grid-cols-1 gap-[var(--px-24)]",
          isAuthenticated ? "lg:[grid-template-columns:minmax(0,1fr)_16rem]" : "",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[60rem] lg:mx-0 lg:max-w-none">{children}</div>
        {isAuthenticated && <WorkspaceRail mode={mode} />}
      </div>
    </div>
  );
};

const TaskCard: React.FC<{
  pressed: boolean;
  title: string;
  description: string;
  outputLabel: string;
  switchCue: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ pressed, title, description, outputLabel, switchCue, icon, onClick }) => {
  const [outPrefix, outValue] = splitOutputLabel(outputLabel);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "relative grid min-h-0 grid-cols-[auto_minmax(0,1fr)] gap-x-[var(--px-16)] gap-y-[var(--px-6)] border bg-[rgba(255,255,255,.015)] p-[var(--px-17)] pb-[var(--px-16)] text-left transition-[border-color,background-color] duration-150 ease-out sm:min-h-[var(--px-108)] sm:p-[var(--px-20)] sm:pb-[var(--px-16)]",
        "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[var(--color-accent,#EE4A26)]",
        pressed
          ? "cursor-default border-[rgba(238,74,38,.6)] bg-[linear-gradient(to_right,rgba(238,74,38,.05),rgba(238,74,38,.012)_55%,transparent)]"
          : "cursor-pointer border-[rgba(255,255,255,.22)] hover:border-[rgba(238,74,38,.45)] hover:[&_.task-cue]:text-[#d4d4d4]",
      ].join(" ")}
    >
      {pressed ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px -left-px -top-px w-[length:var(--px-3)] bg-[var(--color-accent,#EE4A26)]"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={[
          "col-start-1 row-start-1 mt-[var(--px-3)] h-[var(--px-24)] w-[var(--px-24)] transition-colors duration-150",
          pressed ? "text-[var(--color-accent,#EE4A26)]" : "text-[rgba(255,255,255,.55)]",
        ].join(" ")}
      >
        {icon}
      </span>
      <span className="col-start-2 row-start-1 min-w-0">
        <span className="block font-helvetica text-[length:var(--px-16)] font-bold uppercase leading-[var(--px-20)] tracking-[0.03em] text-[var(--color-primary)]">
          {title}
        </span>
        <span className="mt-[var(--px-3)] block text-[length:var(--px-14)] font-helvetica font-light leading-[var(--px-20)] text-[var(--color-primary)] opacity-70">
          {description}
        </span>
      </span>
      <span className="col-start-2 row-start-2 mt-[var(--px-9)] flex flex-wrap items-baseline justify-between gap-x-[var(--px-16)] gap-y-[var(--px-6)] border-t border-dotted border-[rgba(255,255,255,.09)] pt-[var(--px-9)]">
        <span
          className={[
            "font-fira text-[length:var(--px-10-5)] uppercase tracking-[var(--px-1)]",
            pressed ? "text-[rgba(255,255,255,.7)]" : "text-[rgba(255,255,255,.55)]",
          ].join(" ")}
        >
          <span className="font-medium text-[rgba(255,255,255,.7)]">{outPrefix}</span>{" "}
          <span className="text-[rgba(238,74,38,.7)]">//</span> {outValue}
        </span>
        <span
          className={[
            "task-cue font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] transition-colors duration-150",
            pressed ? "text-[var(--color-accent,#EE4A26)]" : "text-[rgba(255,255,255,.55)]",
          ].join(" ")}
        >
          {pressed ? `▸ ${ACTIVE_TASK_LABEL}` : switchCue}
        </span>
      </span>
    </button>
  );
};

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
