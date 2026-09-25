import React from "react";
import { shouldOpenInNewTab, shortGenre } from "@resomix/hooks";
import { ACCENT } from "./charts.js";
import type { RecentAnalysis } from "./useRecentAnalyses.js";

interface AnalysisIntroProps {
  items: RecentAnalysis[];
  /** Open an analysis by its uuid, in place (a plain click). */
  onOpen: (analysisUuid: string) => void;
}

// Short, plain-language facts about what the analysis reveals and why a DJ / producer cares.
const FACTS: { title: string; body: string }[] = [
  { title: "Tempo & Key", body: "Exact BPM and musical key (Camelot), so you can beatmatch and mix in key with confidence." },
  { title: "Energy & Mood", body: "Energy curve and mood mapping, so you can read the vibe before you drop it into a set." },
  { title: "Genre & Instruments", body: "Genre breakdown, detected instruments and stems, so you can find tracks that actually fit together." },
  // Promised a timeline of intro/build/drop/breakdown. Parked with the rest of the structure
  // display, since advertising a panel the result no longer contains reads as a broken feature.
  // { title: "Structure", body: "Intro, build, drop and breakdown laid out on a timeline, so you can cue smarter and transition cleaner." },
];

/** Small accent-barred sub-heading — stands out from body text without being a full heading. */
const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-[var(--px-14)] flex items-center gap-[var(--px-8)]">
    <span aria-hidden="true" className="h-[var(--px-13)] w-[var(--px-3)] flex-shrink-0" style={{ background: ACCENT }} />
    <span className="font-helvetica text-[length:var(--px-13)] font-semibold uppercase tracking-[var(--px-1)] text-white/85">
      {children}
    </span>
  </div>
);

/**
 * Fills the (otherwise empty) Analysis landing: brutal pills to jump back into recently-analysed
 * tracks, then a short "what analysis reveals" panel so a first-time visitor understands the value
 * even with nothing analysed yet.
 */
export const AnalysisIntro: React.FC<AnalysisIntroProps> = ({ items, onOpen }) => {
  return (
    <div className="mx-auto w-full max-w-2xl text-left">
      {/* Recent analyses — quick-open pills (real <a> so right-click / ⌘-click open a new tab). */}
      {items.length > 0 && (
        <div className="mt-[var(--px-40)]">
          <SubHeading>Recent analyses</SubHeading>
          <div className="grid grid-cols-1 gap-[var(--px-10)] sm:grid-cols-2">
            {items.map((a, i) => {
              const meta = [a.bpm ? `${Math.round(a.bpm)} BPM` : null, a.key, a.topGenre ? shortGenre(a.topGenre) : null].filter(Boolean).join(" · ");
              // Odd count → the last pill spans both columns and centres (like a lone flex-wrap item).
              const isLastOdd = items.length % 2 === 1 && i === items.length - 1;
              return (
                <a
                  key={a.analysisUuid}
                  href={`/track-intelligence?id=${a.analysisUuid}`}
                  onClick={(e) => {
                    if (shouldOpenInNewTab(e)) return;
                    e.preventDefault();
                    onOpen(a.analysisUuid);
                  }}
                  title={`${a.artist ? a.artist + " · " : ""}${a.title}`}
                  className={
                    "group flex w-full items-center gap-[var(--px-8)] border border-dotted border-white/25 px-[var(--px-14)] py-[var(--px-9)] " +
                    "font-fira uppercase tracking-wide text-white/80 no-underline transition-colors duration-150 cursor-pointer " +
                    "hover:border-[#EE4A26] hover:bg-white/[0.06] hover:text-white " +
                    (isLastOdd ? "sm:col-span-2 sm:w-1/2 sm:mx-auto" : "")
                  }
                >
                  <span aria-hidden="true" className="h-[var(--px-6)] w-[var(--px-6)] flex-shrink-0 rounded-full" style={{ background: ACCENT }} />
                  <span className="min-w-0 flex-1 truncate text-[length:var(--px-11)]">{a.title}</span>
                  {meta && (
                    <span className="hidden flex-shrink-0 text-[length:var(--px-9)] opacity-45 transition-opacity group-hover:opacity-75 sm:inline">
                      {meta}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* What analysis reveals — facts + DJ/producer benefit. */}
      <div className="mt-[var(--px-40)]">
        <SubHeading>What analysis reveals</SubHeading>
        <p className="mb-[var(--px-16)] font-fira text-[length:var(--px-10)] leading-[var(--px-15)] opacity-55">
          Resomix listens to a track the way a DJ or producer would, so you can key-match,
          energy-sort and build sets that flow.
        </p>
        <div className="grid grid-cols-1 gap-[var(--px-10)] sm:grid-cols-2">
          {FACTS.map((f) => (
            <div key={f.title} className="border border-dotted border-white/25 p-[var(--px-16)]">
              <div className="font-helvetica text-[length:var(--px-12)] font-medium uppercase" style={{ color: ACCENT }}>
                {f.title}
              </div>
              <div className="mt-[var(--px-6)] font-fira text-[length:var(--px-10)] leading-[var(--px-15)] opacity-70">
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisIntro;
