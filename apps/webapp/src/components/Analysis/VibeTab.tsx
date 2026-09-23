import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";

/** The six perceptual meters, in the handoff's order, each with its own colour token. */
const METERS: { label: string; pick: (s: AnalysisData["semantics"]) => number; color: string }[] = [
  { label: "Danceable", pick: (s) => s.danceability, color: "var(--an-meter-danceable)" },
  { label: "Electronic", pick: (s) => s.moodElectronic, color: "var(--an-meter-electronic)" },
  { label: "Vocal", pick: (s) => s.voiceScore, color: "var(--an-meter-vocal)" },
  { label: "Approachable", pick: (s) => s.approachability, color: "var(--an-meter-approachable)" },
  { label: "Bright", pick: (s) => s.timbreBright, color: "var(--an-meter-bright)" },
  { label: "Acoustic", pick: (s) => s.moodAcoustic, color: "var(--an-meter-acoustic)" },
];

/** Tags under this score are listed as names only, not drawn as pills. */
const TAG_FLOOR = 0.2;
/** At or above this, a tag is drawn hot. */
const TAG_HOT = 0.6;

/**
 * Vibe: where the track sits emotionally, how it is built, and what it is about.
 *
 * The radar chart is gone. A radar makes six unrelated scores look like one shape and invites
 * comparisons between axes that do not share a unit; six meters say the same numbers without
 * implying a relationship. The mood tags are weighted instead of uniform, because a 78% tag and a
 * 21% tag printed at the same size read as equally true, which is the opposite of what they are.
 */
export const VibeTab: React.FC<{ data: AnalysisData }> = ({ data }) => {
  const s = data.semantics;
  const tags = [...(s.moodThemeTop ?? [])].sort((a, b) => b.score - a.score);
  const shown = tags.filter((t) => t.score >= TAG_FLOOR);
  const hidden = tags.filter((t) => t.score < TAG_FLOOR);

  // Valence and arousal are −1…+1; the plot is 0…1 from the bottom-left.
  const x = (s.valence + 1) / 2;
  const y = (s.arousal + 1) / 2;

  return (
    <div className="flex flex-col gap-[var(--px-32)] lg:grid lg:grid-cols-[var(--px-360)_minmax(0,1fr)] lg:items-start lg:gap-[var(--px-40)]">
      <section className="flex flex-col gap-[var(--px-10)]">
        <div className="flex items-baseline justify-between gap-[var(--px-10)]">
          <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Valence · Arousal</h2>
          <span className="font-fira text-[length:var(--px-11)] text-[var(--an-text-secondary)]">
            {s.valence >= 0 ? "+" : ""}{s.valence.toFixed(2)} · {s.arousal >= 0 ? "+" : ""}{s.arousal.toFixed(2)}
          </span>
        </div>
        <div className="relative aspect-square w-full rounded-[var(--px-8)] border border-[var(--an-border)] bg-[var(--an-lane)]">
          <span aria-hidden="true" className="absolute inset-x-[var(--px-12)] top-1/2 h-px bg-[var(--an-rule)]" />
          <span aria-hidden="true" className="absolute inset-y-[var(--px-12)] left-1/2 w-px bg-[var(--an-rule)]" />
          <Quadrant className="left-[var(--px-12)] top-[var(--px-10)]" label="energetic" />
          <Quadrant className="right-[var(--px-12)] top-[var(--px-10)]" label="bright" />
          <Quadrant className="left-[var(--px-12)] bottom-[var(--px-10)]" label="dark" />
          <Quadrant className="right-[var(--px-12)] bottom-[var(--px-10)]" label="calm" />
          <span
            className="absolute h-[var(--px-14)] w-[var(--px-14)] -translate-x-1/2 translate-y-1/2 rounded-full bg-[var(--an-accent)]"
            style={{
              left: `${x * 100}%`,
              bottom: `${y * 100}%`,
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--an-accent) 13%, transparent)",
            }}
          >
            <span className="absolute left-[var(--px-18)] top-1/2 -translate-y-1/2 whitespace-nowrap font-fira text-[length:var(--px-10)] text-[var(--an-text-secondary)]">
              this track
            </span>
          </span>
        </div>
      </section>

      <div className="flex flex-col gap-[var(--px-28)]">
        <section className="flex flex-col gap-[var(--px-10)]">
          <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Perceptual profile</h2>
          <div className="grid grid-cols-1 gap-x-[var(--px-24)] lg:grid-cols-2">
            {METERS.map((m) => {
              const v = Math.max(0, Math.min(1, m.pick(s)));
              return (
                <div
                  key={m.label}
                  className="grid min-h-[var(--px-44)] grid-cols-[var(--px-110)_minmax(0,1fr)_var(--px-36)] items-center gap-[var(--px-10)] border-b border-[var(--an-rule)] py-[var(--px-8)]"
                >
                  <span className="font-helvetica text-[length:var(--px-12)] text-[var(--an-text-secondary)]">{m.label}</span>
                  <span className="h-[var(--px-6)] w-full overflow-hidden rounded-[var(--px-3)] bg-[var(--an-border)]">
                    <span className="block h-full rounded-[var(--px-3)]" style={{ width: `${v * 100}%`, background: m.color }} />
                  </span>
                  <span className="text-right font-fira text-[length:var(--px-13)] text-[var(--an-text)]">{Math.round(v * 100)}</span>
                </div>
              );
            })}
          </div>
        </section>

        {tags.length > 0 && (
          <section className="flex flex-col gap-[var(--px-10)]">
            <div className="flex items-baseline justify-between gap-[var(--px-10)]">
              <h2 className="m-0 font-helvetica text-[length:var(--px-14)] font-medium text-[var(--an-text)]">Mood tags</h2>
              <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">below 20% hidden</span>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--px-6)]">
              {shown.map((t) => {
                const hot = t.score >= TAG_HOT;
                // Size carries the score, so the strongest tags read first without a legend.
                const size = 12 + Math.round(Math.min(1, (t.score - TAG_FLOOR) / (1 - TAG_FLOOR)) * 6);
                return (
                  <span
                    key={t.label}
                    className="flex min-h-[var(--px-32)] items-center gap-[var(--px-6)] rounded-[var(--px-4)] font-helvetica lowercase"
                    style={{
                      fontSize: `${size}px`,
                      padding: `${hot ? 9 : 5}px ${hot ? 17 : 11}px`,
                      background: hot ? "var(--an-tag-hot-bg)" : "var(--an-tag-bg)",
                      color: hot ? "var(--an-tag-hot-fg)" : "var(--an-tag-fg)",
                      boxShadow: `inset 0 0 0 1px ${hot ? "color-mix(in srgb, var(--an-tag-hot-fg) 33%, transparent)" : "var(--an-tag-edge)"}`,
                    }}
                  >
                    {t.label}
                    <span className="font-fira text-[length:var(--px-10)] opacity-65">{Math.round(t.score * 100)}%</span>
                  </span>
                );
              })}
            </div>
            {hidden.length > 0 && (
              <p className="m-0 font-fira text-[length:var(--px-10)] text-[var(--an-text-faint)]">
                hidden: {hidden.map((t) => `${t.label} ${Math.round(t.score * 100)}`).join(" · ")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

const Quadrant: React.FC<{ className: string; label: string }> = ({ className, label }) => (
  <span className={`absolute font-fira text-[length:var(--px-10)] uppercase tracking-[0.06em] text-[var(--an-text-muted)] ${className}`}>
    {label}
  </span>
);
