import React, { useEffect } from "react";

/**
 * AnalysisTabs — the four-view tab bar for the full analysis page (design 2b).
 *
 * Four equal cards, each naming its view and saying in one line what is inside. The active card
 * fills cyan (--an-tab-active-*), the one hue no chart on the page uses for data, so it cannot be
 * mistaken for the orange accent or the section palette. Inactive cards stay dark and lift on
 * hover. Keyboard: ArrowLeft / ArrowRight cycle, 1–4 jump. No glow anywhere.
 *
 * `variant="segmented"` is the phone form (handoff, mobile §Layout changes): the four names sit in
 * one rounded track and only the ACTIVE view's description is printed, once, underneath — four
 * descriptions would cost more height than the first lane. The keyboard hint row is dropped there
 * too, since there is no keyboard. Both variants are the same component, on the same state, so a
 * tab cannot disagree with itself across a resize.
 *
 * Tokens live in styles/analysis.css. Fonts are the app's: font-helvetica for text, font-fira for
 * the number keys and the hint row.
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
  variant?: "cards" | "segmented";
}> = ({ value, onChange, variant = "cards" }) => {
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

  if (variant === "segmented") {
    const active = ANALYSIS_TABS.find((t) => t.id === value) ?? ANALYSIS_TABS[0];
    return (
      <div className="flex flex-col gap-[var(--px-8)]">
        <div
          role="tablist"
          aria-label="Analysis views"
          className="grid grid-cols-4 gap-[var(--px-3)] rounded-[var(--px-8)] border border-solid border-[var(--an-tab-border)] bg-[var(--an-tab-bg)] p-[var(--px-3)]"
        >
          {ANALYSIS_TABS.map((t) => {
            const on = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`analysis-panel-${t.id}`}
                id={`analysis-tab-${t.id}`}
                onClick={() => onChange(t.id)}
                className={[
                  "flex h-[var(--px-38)] cursor-pointer items-center justify-center rounded-[var(--px-6)]",
                  "font-helvetica text-[length:var(--px-13)] font-semibold",
                  "transition-[background-color,color] duration-[var(--an-fast)] ease-out",
                ].join(" ")}
                style={{
                  background: on ? "var(--an-tab-active-bg)" : "transparent",
                  color: on ? "var(--an-tab-active-fg)" : "var(--an-tab-desc)",
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
        <p className="m-0 font-helvetica text-[length:var(--px-12)] leading-[1.45] text-[var(--an-tab-desc)] [text-wrap:pretty]">
          {active.desc}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--px-8)]">
      <div role="tablist" aria-label="Analysis views" className="grid grid-cols-4 gap-[var(--px-10)]">
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
              onClick={() => onChange(t.id)}
              className={[
                "flex cursor-pointer flex-col gap-[var(--px-6)] rounded-[var(--px-8)] border border-solid text-left",
                "border-t-[length:var(--px-3)] px-[var(--px-16)] pb-[var(--px-16)] pt-[var(--px-14)]",
                "transition-[background-color,border-color] duration-[var(--an-fast)] ease-out",
                on
                  ? "border-[var(--an-tab-active-fg)] bg-[var(--an-tab-active-bg)]"
                  : "border-[var(--an-tab-border)] border-t-[var(--an-tab-stripe)] bg-[var(--an-tab-bg)] hover:border-[var(--an-tab-border-hover)] hover:bg-[var(--an-tab-bg-hover)]",
              ].join(" ")}
            >
              <span className="flex items-center justify-between">
                <span
                  className="font-helvetica text-[length:var(--px-15)] font-semibold"
                  style={{ color: on ? "var(--an-tab-active-fg)" : "var(--an-tab-fg)" }}
                >
                  {t.name}
                </span>
                <span
                  aria-hidden="true"
                  className="grid h-[var(--px-18)] w-[var(--px-18)] place-items-center rounded-[var(--px-4)] font-fira text-[length:var(--px-10)]"
                  style={{
                    background: on ? "var(--an-tab-active-fg)" : "var(--an-tab-key-bg)",
                    color: on ? "var(--an-page)" : "var(--an-tab-key-fg)",
                  }}
                >
                  {i + 1}
                </span>
              </span>
              <span
                className="font-helvetica text-[length:var(--px-12)] leading-[1.45] [text-wrap:pretty]"
                style={{ color: on ? "var(--an-tab-active-desc)" : "var(--an-tab-desc)" }}
              >
                {t.desc}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-[var(--px-6)] font-fira text-[length:var(--px-10)] tracking-[0.04em] text-[var(--an-tab-hint)]">
        <Key>←</Key><Key>→</Key><span>switch view ·</span><Key>1</Key><span>–</span><Key>4</Key><span>jump</span>
      </div>
    </div>
  );
};

const Key: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-[3px] border border-[var(--an-grid)] px-[var(--px-5)] py-[1px] text-[var(--an-text-muted)]">{children}</span>
);
