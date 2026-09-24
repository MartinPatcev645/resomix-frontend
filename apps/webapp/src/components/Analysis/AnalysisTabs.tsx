import React, { useEffect } from "react";

/**
 * AnalysisTabs — the four-view tab bar for the full analysis page.
 *
 * Deliberately the SAME control as the source tabs on the discovery workspace: one row, dividers
 * between the cells, the active one lifted by the overlay fill and a 2px accent rule underneath.
 * The page had its own cyan card treatment for a while and it read as a different product; a tab
 * bar is chrome, and chrome should look the same everywhere in the app.
 *
 * Only the active view's description is printed, once, under the bar. Four descriptions cost more
 * height than the first lane of the timeline and nobody reads the three that do not apply.
 *
 * Keyboard: ArrowLeft and ArrowRight cycle, 1 to 4 jump. Under 640px the four cells wrap to two
 * rows, the same way the discovery tabs do.
 */

export type AnalysisTab = "timeline" | "harmony" | "vibe" | "genre";

export const ANALYSIS_TABS: { id: AnalysisTab; name: string; desc: string }[] = [
  { id: "timeline", name: "Timeline", desc: "Structure, energy, spectrum, pitch, genre, mood and stems on one shared time axis." },
  { id: "harmony", name: "Harmony", desc: "Camelot wheel, key strength, compatible keys and note energy." },
  { id: "vibe", name: "Vibe", desc: "Valence and arousal, perceptual profile and weighted mood tags." },
  { id: "genre", name: "Genre", desc: "Both genre models in one ranked list." },
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

  const active = ANALYSIS_TABS.find((t) => t.id === value) ?? ANALYSIS_TABS[0];

  return (
    <div className="flex flex-col gap-[var(--px-10)]">
      <div
        role="tablist"
        aria-label="Analysis views"
        className="flex w-full border border-[var(--rx-color-border-subtle)] max-[640px]:grid max-[640px]:grid-cols-2"
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
                "ws-focus-ring min-h-[var(--px-44)] flex-1 shrink-0 cursor-pointer border-r border-[var(--rx-color-border-subtle)]",
                "px-[var(--px-24)] py-[var(--px-12)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)]",
                "transition-[background-color,color,box-shadow] duration-[var(--rx-duration-base)] ease-[var(--rx-ease-standard)]",
                "last:border-r-0 max-[640px]:px-[var(--px-8)] max-[640px]:text-center",
                on
                  ? "bg-[var(--rx-color-overlay)] text-[var(--rx-color-text-primary)] shadow-[inset_0_-2px_0_0_var(--rx-color-accent)]"
                  : "text-[var(--rx-color-text-secondary)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[var(--rx-color-text-primary)]",
              ].join(" ")}
            >
              <span aria-hidden="true" className="mr-[var(--px-8)] opacity-50">
                {i + 1}
              </span>
              {t.name}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-[var(--px-8)]">
        <p className="m-0 font-helvetica text-[length:var(--px-12)] leading-[1.45] text-[var(--an-tab-desc)] [text-wrap:pretty]">
          {active.desc}
        </p>
        {showHint && (
          <span className="flex shrink-0 items-center gap-[var(--px-6)] font-fira text-[length:var(--px-10)] tracking-[0.04em] text-[var(--an-tab-hint)]">
            <Key>←</Key>
            <Key>→</Key>
            <span>switch view ·</span>
            <Key>1</Key>
            <span>–</span>
            <Key>4</Key>
            <span>jump</span>
          </span>
        )}
      </div>
    </div>
  );
};

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-[3px] border border-[var(--an-grid)] px-[var(--px-5)] py-[1px] text-[var(--an-text-muted)]">{children}</span>
);
