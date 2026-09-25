import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { CamelotWheel, chromaLabelsForKey, keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import {
  camelotNeighbours,
  camelotRootPitchClass,
  inKeyPitchClasses,
  meanChromaFromMatrix,
} from "@/utils/analysisTimeline.ts";

/**
 * Harmony: the key, what mixes with it, and which notes the track actually spends its energy on.
 *
 * The wheel is the one thing on this page that was already right, so it is untouched. What is new
 * is the answer a DJ wants next to it: the three neighbouring Camelot codes and the relative
 * major or minor, spelled as real key names, plus the note energy behind the reading so a weak or
 * ambiguous key can be judged rather than trusted.
 */
export const HarmonyTab: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const { tonality } = data;
  const keyLabel = keyFromCamelot(tonality.camelot);
  const altLabel = keyFromCamelot(tonality.altCamelot);
  const neighbours = camelotNeighbours(tonality.camelot);

  // Spelled for the key: F minor reads Db and Eb, not C# and D#.
  const noteNames = chromaLabelsForKey(tonality.camelot);
  const inKey = inKeyPitchClasses(tonality.camelot);
  const tonicIndex = camelotRootPitchClass(tonality.camelot) ?? -1;

  // `mean_chroma` only exists on results from the semantics stage onwards. Recompute it from the
  // chromagram we already have rather than leaving the chart blank on an older analysis.
  const chroma =
    tonality.meanChroma?.length === 12 ? tonality.meanChroma : meanChromaFromMatrix(tonality.chromagram?.data);
  const chromaMax = chroma.reduce((m, v) => (v > m ? v : m), 0) || 1;
  const chromaTotal = chroma.reduce((a, b) => a + b, 0);
  const tonicShare =
    chromaTotal > 0 && tonicIndex >= 0 ? Math.round((chroma[tonicIndex] / chromaTotal) * 100) : null;

  return (
    <div className="flex flex-col gap-[var(--px-32)] lg:grid lg:grid-cols-[var(--px-400)_minmax(0,1fr)] lg:items-start lg:gap-[var(--px-40)]">
      <div className="flex flex-col items-center gap-[var(--px-16)]">
        <div className="w-full max-w-[var(--px-360)]">
          <CamelotWheel camelot={tonality.camelot ?? ""} />
        </div>
        {tonality.ambiguous && (
          <p className="m-0 w-full rounded-[var(--px-4)] bg-[var(--an-flag-bg)] px-[var(--px-12)] py-[var(--px-8)] font-fira text-[length:var(--px-11)] text-[var(--an-flag-fg)]">
            ⚠ Key may be ambiguous
            {altLabel ? ` · possibly ${altLabel.name} ${altLabel.scale} (${tonality.altCamelot})` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[var(--px-28)]">
        <div className="grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-3">
          <KeyCard
            label="Key"
            value={keyLabel ? `${keyLabel.name} ${keyLabel.scale}` : "—"}
            sub={
              tonality.camelot
                ? `${tonality.camelot} Camelot · ${(tonality.strength * 100).toFixed(0)}% strength`
                : "not read yet"
            }
          />
          <KeyCard
            label="Alternative"
            value={altLabel ? `${altLabel.name} ${altLabel.scale}` : "—"}
            sub={tonality.altCamelot ? `${tonality.altCamelot} Camelot · second candidate` : "no second candidate"}
            dim
          />
          <KeyCard
            label="Tonic"
            value={keyLabel?.name ?? "—"}
            sub={tonicShare == null ? "—" : `${tonicShare}% of pitch energy`}
            accent
          />
        </div>

        {neighbours.length > 0 && (
          <section className="flex flex-col gap-[var(--px-12)]">
            <SectionHeading>Mix-compatible keys</SectionHeading>
            <div className="grid grid-cols-2 gap-[var(--px-10)] lg:grid-cols-4">
              {neighbours.map((n) => {
                const label = keyFromCamelot(n.code);
                return (
                  <div
                    key={n.relation}
                    className="rounded-[var(--px-6)] border border-[var(--an-border)] bg-[var(--an-lane)] p-[var(--px-12)]"
                  >
                    <div className="flex items-baseline justify-between gap-[var(--px-8)]">
                      <span className="font-helvetica text-[length:var(--px-18)] font-semibold text-[var(--an-text)]">
                        {n.code}
                      </span>
                      <span className="truncate font-fira text-[length:var(--px-11)] text-[var(--an-text-secondary)]">
                        {label ? `${label.name} ${label.scale}` : "—"}
                      </span>
                    </div>
                    <div className="mt-[var(--px-6)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
                      {n.relation}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {chroma.length === 12 && (
          <section className="flex flex-col gap-[var(--px-12)]">
            <div className="flex flex-wrap items-baseline justify-between gap-[var(--px-12)]">
              <SectionHeading>Note energy</SectionHeading>
              <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
                whole track · in-key notes lit, others dimmed
              </span>
            </div>
            <div className="flex items-end gap-[var(--px-6)]">
              {noteNames.map((note, i) => {
                const isTonic = i === tonicIndex;
                // No readable key means no claim about which notes belong: show them all evenly
                // rather than dimming at random.
                const opacity = !inKey.size ? 0.7 : isTonic ? 1 : inKey.has(i) ? 0.55 : 0.15;
                return (
                  <div key={note + i} className="flex min-w-0 flex-1 flex-col items-center gap-[var(--px-4)]">
                    {/* The bar is absolute inside a box with a DEFINITE height. A percentage height
                        inside a flex item depends on the flex item having resolved a height first,
                        which is exactly the kind of thing that silently renders nothing. */}
                    <div className="relative h-[var(--px-84)] w-full lg:h-[var(--px-110)]">
                      <div
                        className="absolute bottom-0 left-0 w-full rounded-t-[var(--px-2)] bg-[var(--an-pitch)]"
                        style={{ height: `${Math.max(2, (chroma[i] / chromaMax) * 100)}%`, opacity }}
                      />
                    </div>
                    <span
                      className={`font-fira text-[length:var(--px-10)] ${
                        isTonic
                          ? "font-semibold text-[var(--an-pitch)]"
                          : inKey.has(i) || !inKey.size
                            ? "text-[var(--an-text-secondary)]"
                            : "text-[var(--an-text-faint)]"
                      }`}
                    >
                      {note}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="m-0 font-fira text-[length:var(--px-11)] font-semibold uppercase tracking-[var(--px-2)] text-[var(--an-text-strong)]">
    {children}
  </h2>
);

/**
 * One key fact, in the page's own card language rather than the generic StatCard: fira label in
 * caps, the value large in Helvetica, the qualifier underneath in the muted tone.
 */
const KeyCard: React.FC<{ label: string; value: string; sub: string; dim?: boolean; accent?: boolean }> = ({
  label,
  value,
  sub,
  dim = false,
  accent = false,
}) => (
  <div className="rounded-[var(--px-8)] border border-[var(--an-border)] bg-[var(--an-card)] p-[var(--px-14)]">
    <div className="font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-2)] text-[var(--an-text-muted)]">
      {label}
    </div>
    <div
      className="mt-[var(--px-6)] font-helvetica text-[length:var(--px-26)] font-medium leading-none"
      style={{ color: accent ? "var(--an-pitch)" : dim ? "var(--an-text-strong)" : "var(--an-text)" }}
    >
      {value}
    </div>
    <div className="mt-[var(--px-8)] font-fira text-[length:var(--px-11)] text-[var(--an-text-muted)]">{sub}</div>
  </div>
);
