import React from "react";
import { shortGenre } from "@resomix/hooks";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { BarList } from "@/pages/analysis/charts.tsx";

/**
 * How many rows each list shows. Beyond this the scores are noise.
 *
 * The PDF export prints the same lists (TOP_N in export/buildAnalysisPdf.ts) and the two must match:
 * a forwarded PDF that lists three genres the page never showed reads as a different result.
 */
const TOP_N = 10;

/**
 * Genre and sonic style, as two ranked lists.
 *
 * They were briefly merged into one list with two bars per row, and it was worse: a reader had to
 * decode which bar was which before reading anything, and two readings that disagree are easier to
 * compare side by side than interleaved. Two lists, same scale, same colour.
 *
 * The headings name what a reader gets, not what produced it. Which model each column comes from
 * is ours to know and change.
 */
export const GenreTab: React.FC<{ data: AnalysisData; onOpenTimeline: () => void }> = ({ data, onOpenTimeline }) => {
  const genre = (data.semantics.styleTop ?? []).slice(0, TOP_N);
  const style = (data.semantics.genreTop ?? []).slice(0, TOP_N);

  return (
    <div className="flex flex-col gap-[var(--px-24)]">
      <div className="grid grid-cols-1 gap-[var(--px-16)] lg:grid-cols-2 lg:gap-[var(--px-24)]">
        <ListPanel title="Genre" subtitle={`top ${TOP_N}`} items={genre} empty="Genre needs the model pass, filling in shortly." />
        <ListPanel title="Sonic style" subtitle={`top ${TOP_N}`} items={style} empty="Style needs the model pass, filling in shortly." />
      </div>

      <p className="m-0 font-helvetica text-[length:var(--px-13)] font-light text-[var(--an-text-secondary)]">
        Two readings of the same track. Where they agree, the label is safe to file under.{" "}
        <button
          type="button"
          onClick={onOpenTimeline}
          className="cursor-pointer underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--an-text)]"
        >
          How it changes through the track is on the Timeline tab
        </button>
        .
      </p>
    </div>
  );
};

const ListPanel: React.FC<{
  title: string;
  subtitle: string;
  items: AnalysisData["semantics"]["genreTop"];
  empty: string;
}> = ({ title, subtitle, items, empty }) => (
  <section className="rounded-[var(--px-10)] border border-[var(--an-border)] bg-[var(--an-card)] p-[var(--px-16)]">
    <h2 className="m-0 font-fira text-[length:var(--px-11)] font-semibold uppercase tracking-[var(--px-2)] text-[var(--an-text-strong)]">
      {title}
    </h2>
    <p className="m-0 mb-[var(--px-12)] mt-[var(--px-4)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
      {subtitle}
    </p>
    {items.length > 0 ? (
      <BarList items={items} labelTransform={shortGenre} />
    ) : (
      <p className="m-0 font-helvetica text-[length:var(--px-12)] font-light text-[var(--an-text-muted)]">{empty}</p>
    )}
  </section>
);
