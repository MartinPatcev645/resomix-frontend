import React, { useEffect } from "react";
import { PAGE_MARK_INTERACTIVE } from "@resomix/ui";
import { WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";

/**
 * AnalysisTabs — the four-view tab bar for the full analysis page.
 *
 * Built from the same card the workspace uses for "what do you want to do", because that is the
 * control this page's reader has already met: the top-left mark, the accent border and tinted fill
 * on the chosen one, the title in caps and one line saying what is inside. Only the contents
 * differ, four views instead of two tasks, with a number key where the task cards carry an icon.
 *
 * Keyboard: ArrowLeft and ArrowRight cycle, 1 to 4 jump. The cards drop to two columns on a
 * tablet and one on a phone, the same way the task cards do.
 */

export type AnalysisTab = "timeline" | "harmony" | "vibe" | "genre";

export const ANALYSIS_TABS: { id: AnalysisTab; name: string; desc: string }[] = [
  { id: "timeline", name: "Timeline", desc: "Structure, energy, spectrum, pitch, style, mood and stems on one shared time axis." },
  { id: "harmony", name: "Harmony", desc: "Camelot wheel, key strength, compatible keys and note energy." },
  { id: "vibe", name: "Vibe", desc: "Valence and arousal, perceptual profile and weighted mood tags." },
  { id: "genre", name: "Genre & Sonic Style", desc: "Two ranked readings of what the track is." },
];

/** `?tab=` is user-supplied, so anything unknown falls back to the first view rather than a blank page. */
export const isAnalysisTab = (v: string | null): v is AnalysisTab =>
  !!v && ANALYSIS_TABS.some((t) => t.id === v);

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export const AnalysisTabs: React.FC<{
  value: AnalysisTab;
  onChange: (t: AnalysisTab) => void;
  /** Desktop shows the keyboard hint row; a phone has no keyboard to hint at. */
  showHint?: boolean;
}> = ({ value, onChange, showHint = true }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = ANALYSIS_TABS.findIndex((t) => t.id === value);
      if (e.key === "ArrowRight") onChange(ANALYSIS_TABS[(i + 1) % ANALYSIS_TABS.length].id);
      else if (e.key === "ArrowLeft") onChange(ANALYSIS_TABS[(i + ANALYSIS_TABS.length - 1) % ANALYSIS_TABS.length].id);
      else if (/^[1-4]$/.test(e.key)) onChange(ANALYSIS_TABS[Number(e.key) - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange]);

  return (
    <div className="flex flex-col gap-[var(--px-8)]">
      <div
        role="tablist"
        aria-label="Analysis views"
        className="grid grid-cols-2 gap-[var(--px-10)] sm:gap-[var(--px-12)] lg:grid-cols-4"
      >
        {ANALYSIS_TABS.map((t, i) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`analysis-panel-${t.id}`}
              id={`analysis-tab-${t.id}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(t.id)}
              className={[
                "ws-transition flex h-full flex-col gap-[var(--px-8)] border p-[var(--px-14)] text-left",
                "transition-[border-color,background-color] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
                PAGE_MARK_INTERACTIVE,
                WORKSPACE_FOCUS_VISIBLE,
                on
                  ? "ws-mode-card-selected cursor-default border-[var(--rx-color-accent)] bg-[var(--rx-color-selected)]"
                  : "cursor-pointer border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.035)]",
              ].join(" ")}
            >
              <span className="flex min-w-0 items-center gap-[var(--px-10)]">
                <span
                  aria-hidden="true"
                  className={[
                    "shrink-0 rounded-[var(--rx-radius-tag)] border px-[var(--px-6)] py-[var(--px-1)]",
                    "font-fira text-[length:var(--px-11)] font-medium",
                    on
                      ? "border-[var(--rx-color-accent)] text-[var(--rx-color-accent)]"
                      : "border-[var(--rx-color-border-default)] text-[var(--rx-color-text-secondary)]",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 font-helvetica text-[length:var(--px-14)] font-bold uppercase leading-[var(--px-18)] tracking-[0.03em] text-[var(--rx-color-text-primary)]">
                  {t.name}
                </span>
              </span>
              <span className="hidden font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-17)] text-[var(--rx-color-text-secondary)] [text-wrap:pretty] sm:block">
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>

      <p className="m-0 font-helvetica text-[length:var(--px-12)] font-light leading-[1.45] text-[var(--rx-color-text-secondary)] sm:hidden">
        {(ANALYSIS_TABS.find((t) => t.id === value) ?? ANALYSIS_TABS[0]).desc}
      </p>

      {showHint && (
        <div className="flex items-center justify-end gap-[var(--px-6)] font-fira text-[length:var(--px-10)] tracking-[0.04em] text-[var(--an-tab-hint)]">
          <Key>←</Key>
          <Key>→</Key>
          <span>switch view ·</span>
          <Key>1</Key>
          <span>–</span>
          <Key>4</Key>
          <span>jump</span>
        </div>
      )}
    </div>
  );
};

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-[3px] border border-[var(--an-grid)] px-[var(--px-5)] py-[1px] text-[var(--an-text-muted)]">{children}</span>
);
