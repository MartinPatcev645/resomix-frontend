import React, { useMemo } from "react";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { genreAgreement, mergeGenreModels } from "@/utils/analysisTimeline.ts";

/**
 * Genre: both models in one ranked list instead of two lists side by side.
 *
 * Two lists made the reader do the join. Merged and sorted by the models' agreement, the list
 * answers the question they were actually asking — what is this track, and how sure is anyone —
 * in one pass. A label only one model knows still appears, with a dash where the other would be,
 * so a single model's find is visible as exactly that.
 */
export const GenreTab: React.FC<{ data: AnalysisData; onOpenTimeline: () => void }> = ({ data, onOpenTimeline }) => {
  const rows = useMemo(
    () => mergeGenreModels(data.semantics.genreTop ?? [], data.semantics.styleMaestTop ?? [], shortGenre),
    [data.semantics.genreTop, data.semantics.styleMaestTop],
  );

  return (
    <div className="flex flex-col gap-[var(--px-16)]">
      <div className="flex flex-wrap items-baseline justify-between gap-[var(--px-10)]">
        <div className="flex items-baseline gap-[var(--px-10)]">
          <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Genre &amp; style</h2>
          <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">two models, one list · sorted by agreement</span>
        </div>
        <div className="flex items-center gap-[var(--px-12)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
          <Swatch color="var(--an-model-discogs)" label="Discogs-400" />
          <Swatch color="var(--an-model-maest)" label="MAEST-519" />
        </div>
      </div>

      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[var(--px-12)] gap-y-[var(--px-6)] border-b border-[var(--an-rule)] py-[var(--px-12)] lg:grid-cols-[var(--px-200)_minmax(0,1fr)_var(--px-120)]"
            style={{ opacity: r.max < 0.2 ? 0.5 : 1 }}
          >
            <span
              className={`min-w-0 truncate font-helvetica text-[length:var(--px-13)] lowercase text-[var(--an-text)] ${r.max >= 0.6 ? "font-semibold" : ""}`}
            >
              {r.label}
            </span>
            <span className="order-last col-span-2 flex flex-col gap-[var(--px-3)] lg:order-none lg:col-span-1">
              <Bar value={r.discogs} color="var(--an-model-discogs)" />
              <Bar value={r.maest} color="var(--an-model-maest)" />
            </span>
            <span className="text-right font-fira text-[length:var(--px-12)] text-[var(--an-text-secondary)] tabular-nums">
              {pct(r.discogs)} · {pct(r.maest)}
            </span>
          </div>
        ))}
      </div>

      <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--an-text-secondary)]">
        {genreAgreement(rows)}{" "}
        <button
          type="button"
          onClick={onOpenTimeline}
          className="cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--an-text)]"
        >
          Genre over time is on the Timeline tab
        </button>
        .
      </p>
    </div>
  );
};

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

const Bar: React.FC<{ value: number | null; color: string }> = ({ value, color }) => (
  <span className="block h-[var(--px-6)] w-full overflow-hidden rounded-[var(--px-3)] bg-[var(--an-border)]">
    <span
      className="block h-full rounded-[var(--px-3)]"
      style={{ width: `${Math.max(0, Math.min(1, value ?? 0)) * 100}%`, background: color }}
    />
  </span>
);

const Swatch: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-[var(--px-5)]">
    <span className="inline-block h-[var(--px-8)] w-[var(--px-8)] rounded-[var(--px-2)]" style={{ background: color }} />
    {label}
  </span>
);
