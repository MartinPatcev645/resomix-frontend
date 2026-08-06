import React from "react";
import { ACCENT } from "@/pages/analysis/charts.tsx";

/**
 * FullAnalysisLocked — what the full Track Intelligence page shows to a plan without
 * `can_view_full_analysis` (pricing v2.1 §1.6).
 *
 * The server does not send the dashboard's data to an unentitled caller: spectrograms, timelines,
 * chromagram, beat grids and stem composition are absent from the payload, not hidden with CSS. So
 * this is not decoration over data we already sent — without it the page would render empty charts
 * over missing sections, which reads as broken rather than as a paywall.
 *
 * The copy leads with what the reader still HAS. They uploaded a track and got a complete summary;
 * being told only what they cannot see would misdescribe their own account.
 */
export interface FullAnalysisLockedProps {
  /** Back to the summary card the caller is entitled to. */
  onBack?: () => void;
  className?: string;
}

const LockGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" focusable="false">
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const FullAnalysisLocked: React.FC<FullAnalysisLockedProps> = ({ onBack, className = "" }) => (
  <div className={`mx-auto w-full max-w-2xl ${className}`}>
    <div
      className="flex flex-col items-center gap-[var(--px-12)] rounded-[var(--px-16)] border border-dashed p-[var(--px-56)] text-center"
      style={{ borderColor: ACCENT }}
    >
      <LockGlyph className="w-[var(--px-24)] h-[var(--px-24)] opacity-70" />

      <span
        className="font-helvetica text-[length:var(--px-14)] font-medium uppercase"
        style={{ color: ACCENT }}
      >
        Full Track Intelligence is a Pro feature
      </span>

      <span className="max-w-md break-words font-helvetica text-[length:var(--px-11)] font-light opacity-70">
        Your summary — BPM, key, energy and structure — stays free. Pro adds the full breakdown:
        spectrograms, the chromagram, beat and phrase grids, mood and genre over time, and stem
        composition.
      </span>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-[var(--px-8)] rounded-full border border-[var(--opacity-30)] px-[var(--px-16)] py-[var(--px-6)] font-helvetica text-[length:var(--px-11)] uppercase hover:bg-[var(--opacity-15)] cursor-pointer"
        >
          Back to summary
        </button>
      )}
    </div>
  </div>
);

export default FullAnalysisLocked;
