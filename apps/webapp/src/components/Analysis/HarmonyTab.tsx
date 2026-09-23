import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";
import { StatCard } from "@/pages/analysis/charts.tsx";
import { CamelotWheel, chromaLabelsForKey, keyFromCamelot } from "@/pages/analysis/heatviz.tsx";
import { camelotNeighbours } from "@/utils/analysisTimeline.ts";

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Harmony: the key, what mixes with it, and which notes the track actually spends its energy on.
 *
 * The wheel is the one thing on this page that was already right, so it is untouched. What is new
 * is the answer a DJ wants next to it: the three neighbouring Camelot codes and the relative
 * major/minor, spelled as real key names, plus the note energy behind the reading so a weak or
 * ambiguous key can be judged rather than trusted.
 */
export const HarmonyTab: React.FC<{ data: AnalysisData; isDesktop: boolean }> = ({ data, isDesktop }) => {
  const { tonality } = data;
  const keyLabel = keyFromCamelot(tonality.camelot);
  const altLabel = keyFromCamelot(tonality.altCamelot);
  const inKey = new Set(chromaLabelsForKey(tonality.camelot));
  const tonic = keyLabel?.name ?? null;
  const neighbours = camelotNeighbours(tonality.camelot);

  const chroma = tonality.meanChroma ?? [];
  const chromaMax = chroma.reduce((m, v) => (v > m ? v : m), 0) || 1;
  const tonicShare = (() => {
    const total = chroma.reduce((a, b) => a + b, 0);
    if (!total || !tonic) return null;
    const i = NOTES.indexOf(tonic.replace("b", "#"));
    if (i < 0) return null;
    return Math.round((chroma[i] / total) * 100);
  })();

  return (
    <div className="flex flex-col gap-[var(--px-32)] lg:grid lg:grid-cols-[var(--px-400)_minmax(0,1fr)] lg:items-start lg:gap-[var(--px-40)]">
      <div className="flex flex-col items-center gap-[var(--px-16)]">
        <div className="w-full max-w-[var(--px-360)]">
          <CamelotWheel camelot={tonality.camelot ?? ""} />
        </div>
        {tonality.ambiguous && (
          <p className="m-0 w-full rounded-[var(--px-4)] bg-[var(--an-flag-bg)] px-[var(--px-12)] py-[var(--px-8)] text-center font-fira text-[length:var(--px-11)] text-[var(--an-flag-fg)]">
            Key may be ambiguous{altLabel ? ` · possibly ${altLabel.name} ${altLabel.scale} (${tonality.altCamelot})` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-[var(--px-28)]">
        <div className="grid grid-cols-1 gap-[var(--px-12)] sm:grid-cols-3">
          <StatCard
            label="Key"
            value={keyLabel ? `${keyLabel.name} ${keyLabel.scale}` : "—"}
            sub={tonality.camelot ? `${tonality.camelot} Camelot · ${(tonality.strength * 100).toFixed(0)}% strength` : undefined}
          />
          <StatCard
            label="Alternative"
            value={<span className="text-[var(--an-text-strong)]">{altLabel ? `${altLabel.name} ${altLabel.scale}` : "—"}</span>}
            sub={tonality.altCamelot ? `${tonality.altCamelot} Camelot · second candidate` : "no second candidate"}
          />
          <StatCard
            label="Tonic"
            value={<span className="text-[var(--an-pitch)]">{tonic ?? "—"}</span>}
            sub={tonicShare == null ? undefined : `${tonicShare}% of pitch energy`}
          />
        </div>

        {neighbours.length > 0 && (
          <section className="flex flex-col gap-[var(--px-12)]">
            <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Mix-compatible keys</h2>
            <div className="grid grid-cols-2 gap-[var(--px-10)] lg:grid-cols-4">
              {neighbours.map((n) => {
                const label = keyFromCamelot(n.code);
                return (
                  <div key={n.relation} className="rounded-[var(--px-6)] border border-[var(--an-border)] bg-[var(--an-lane)] p-[var(--px-12)]">
                    <div className="font-helvetica text-[length:var(--px-18)] font-semibold text-[var(--an-text)]">{n.code}</div>
                    <div className="mt-[var(--px-2)] font-fira text-[length:var(--px-11)] text-[var(--an-text-secondary)]">
                      {label ? `${label.name} ${label.scale}` : "—"}
                    </div>
                    <div className="mt-[var(--px-4)] font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">{n.relation}</div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {chroma.length === 12 && (
          <section className="flex flex-col gap-[var(--px-12)]">
            <div className="flex items-baseline justify-between gap-[var(--px-12)]">
              <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Note energy</h2>
              <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">whole track · in-key notes lit</span>
            </div>
            <div className="flex h-[var(--px-84)] items-end gap-[var(--px-6)] lg:h-[var(--px-110)]">
              {NOTES.map((note, i) => {
                const isTonic = tonic != null && note === tonic.replace("b", "#");
                const opacity = isTonic ? 1 : inKey.has(note) ? 0.55 : 0.15;
                return (
                  <div key={note} className="flex min-w-0 flex-1 flex-col items-center gap-[var(--px-4)]">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-[var(--px-2)] bg-[var(--an-pitch)]"
                        style={{ height: `${Math.max(2, (chroma[i] / chromaMax) * 100)}%`, opacity }}
                      />
                    </div>
                    <span
                      className={`font-fira text-[length:var(--px-10)] ${isTonic ? "font-semibold text-[var(--an-pitch)]" : "text-[var(--an-text-muted)]"}`}
                    >
                      {isDesktop || note.length === 1 ? note : note.replace("#", "♯")}
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
