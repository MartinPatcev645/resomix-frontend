import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@resomix/stores";
import {
  ACTIVE_TASK_LABEL,
  ANALYSIS_TASK_DESC,
  ANALYSIS_TASK_TITLE,
  DISCOVERY_TASK_DESC,
  DISCOVERY_TASK_TITLE,
  LOOP_STRIP_STORAGE_KEY,
  LOOP_STRIP_TEXT,
  WORKSPACE_HEADING,
  WORKSPACE_SUBLINE,
} from "./workspaceCopy.ts";
import { WorkspaceRail } from "./WorkspaceRail.tsx";
import { autoFluidGridStyle } from "@/utils/playlistGrid.ts";

export type WorkspaceMode = "discovery" | "analysis";

interface WorkspaceShellProps {
  mode: WorkspaceMode;
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({ mode, children }) => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [loopVisible, setLoopVisible] = useState(true);

  useEffect(() => {
    setLoopVisible(localStorage.getItem(LOOP_STRIP_STORAGE_KEY) !== "true");
  }, []);

  const dismissLoop = () => {
    localStorage.setItem(LOOP_STRIP_STORAGE_KEY, "true");
    setLoopVisible(false);
  };

  const selectTask = (next: WorkspaceMode) => {
    if (next === mode) return;
    navigate(next === "discovery" ? "/sonic-discovery" : "/analysis");
  };

  return (
    <div className="webapp-approved-container px-[var(--px-32)] pb-[var(--px-64)]">
      <header className="flex flex-wrap items-end justify-between gap-[var(--px-24)] pb-[var(--px-20)] pt-[var(--px-28)]">
        <div>
          <p className="mb-[var(--px-10)] flex items-center gap-[var(--px-8)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-2)] text-[var(--color-primary)] opacity-75 before:block before:w-[var(--px-28)] before:border-t before:border-[var(--color-accent,#EE4A26)] before:content-['']">
            Workspace // Production beta
          </p>
          <h1 className="font-benzin text-[length:var(--px-28)] uppercase leading-[var(--px-32)] md:text-[length:var(--px-36)] md:leading-[var(--px-40)]">
            {WORKSPACE_HEADING}
          </h1>
          <p className="mt-[var(--px-8)] max-w-[34rem] text-[length:var(--px-15)] font-helvetica font-light leading-[var(--px-20)] opacity-70">
            {WORKSPACE_SUBLINE}
          </p>
        </div>
        <span className="whitespace-nowrap border border-dotted border-slate-200 px-[var(--px-10)] py-[var(--px-6)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
          {isAuthenticated ? "Signed in" : "Guest session"}
        </span>
      </header>

      <div className="mb-[var(--px-16)] grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-2" role="group" aria-label="Choose your task">
        <TaskButton
          pressed={mode === "discovery"}
          title={DISCOVERY_TASK_TITLE}
          description={DISCOVERY_TASK_DESC}
          onClick={() => selectTask("discovery")}
        />
        <TaskButton
          pressed={mode === "analysis"}
          title={ANALYSIS_TASK_TITLE}
          description={ANALYSIS_TASK_DESC}
          onClick={() => selectTask("analysis")}
        />
      </div>

      {loopVisible && (
        <div className="mb-[var(--px-20)] flex flex-wrap items-center gap-[var(--px-10)] border border-dotted border-slate-200 px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-60">
          <span>{LOOP_STRIP_TEXT}</span>
          <button
            type="button"
            className="ml-auto inline-flex h-[var(--px-44)] min-w-[var(--px-44)] items-center justify-center text-[length:var(--px-14)] opacity-70 hover:opacity-100"
            aria-label="Dismiss loop strip"
            onClick={dismissLoop}
          >
            ✕
          </button>
        </div>
      )}

      <div
        className={[
          "grid grid-cols-1 gap-[var(--px-24)]",
          isAuthenticated ? "lg:[grid-template-columns:minmax(0,1fr)_16rem]" : "",
        ].join(" ")}
      >
        <div className="mx-auto w-full max-w-[60rem] lg:mx-0 lg:max-w-none">{children}</div>
        {isAuthenticated && <WorkspaceRail />}
      </div>
    </div>
  );
};

const TaskButton: React.FC<{
  pressed: boolean;
  title: string;
  description: string;
  onClick: () => void;
}> = ({ pressed, title, description, onClick }) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className={[
      "relative grid min-h-[var(--px-96)] items-start gap-x-[var(--px-14)] gap-y-[var(--px-4)] border border-dotted border-slate-200 p-[var(--px-16)] text-left transition-colors",
      pressed
        ? "border-[color:rgba(238,74,38,.55)] border-l-[length:var(--px-3)] border-l-[var(--color-accent,#EE4A26)] bg-[linear-gradient(100deg,rgba(238,74,38,.16),rgba(238,74,38,.04)_55%,rgba(255,255,255,.02))] pl-[calc(var(--px-16)-var(--px-2))]"
        : "bg-[rgba(255,255,255,.02)] hover:border-slate-300",
    ].join(" ")}
    style={
      pressed
        ? {
            ...autoFluidGridStyle,
            clipPath: "polygon(0.875rem 0, 100% 0, 100% 100%, 0 100%, 0 0.875rem)",
          }
        : autoFluidGridStyle
    }
  >
    <span
      aria-hidden="true"
      className={[
        "col-start-1 row-start-1 row-span-3 mt-[var(--px-2)] flex h-[var(--px-24)] w-[var(--px-24)] items-center justify-center border-2",
        pressed ? "border-[var(--color-accent,#EE4A26)]" : "border-slate-400",
      ].join(" ")}
    >
      <span
        className={[
          "block h-[var(--px-8)] w-[var(--px-8)]",
          pressed ? "bg-[var(--color-accent,#EE4A26)]" : "bg-slate-400",
        ].join(" ")}
      />
    </span>
    <span className="col-start-2 row-start-1 font-helvetica text-[length:var(--px-17)] font-medium uppercase tracking-[var(--px-1)]">
      {title}
    </span>
    <span
      className={[
        "col-start-2 row-start-2 text-[length:var(--px-13)] font-helvetica font-light leading-[var(--px-18)]",
        pressed ? "opacity-70" : "opacity-50",
      ].join(" ")}
    >
      {description}
    </span>
    {pressed && (
      <span className="col-start-2 row-start-3 mt-[var(--px-6)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--color-accent,#EE4A26)]">
        ▸ {ACTIVE_TASK_LABEL}
      </span>
    )}
  </button>
);
