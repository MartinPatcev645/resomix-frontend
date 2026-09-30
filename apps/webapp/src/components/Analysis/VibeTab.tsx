import React from "react";
import type { AnalysisData } from "@/pages/analysis/data.ts";

/**
 * The six perceptual meters, in the handoff's order, each with its own colour token.
 *
 * The second line says what the number is OF. "Bright 52" means nothing on its own, and a reader
 * guessing at it will guess wrong: three of these six are one end of a pair rather than an amount
 * of something, so the axis has to be printed or the score is unreadable.
 */
const METERS: { label: string; sub: string; pick: (s: AnalysisData["semantics"]) => number; color: string }[] = [
  { label: "Danceable", sub: "rhythm regularity", pick: (s) => s.danceability, color: "var(--an-meter-danceable)" },
  { label: "Electronic", sub: "vs acoustic", pick: (s) => s.moodElectronic, color: "var(--an-meter-electronic)" },
  { label: "Vocal", sub: "voice presence", pick: (s) => s.voiceScore, color: "var(--an-meter-vocal)" },
  { label: "Approachable", sub: "vs experimental", pick: (s) => s.approachability, color: "var(--an-meter-approachable)" },
  { label: "Bright", sub: "vs dark", pick: (s) => s.timbreBright, color: "var(--an-meter-bright)" },
  { label: "Acoustic", sub: "instrumentation", pick: (s) => s.moodAcoustic, color: "var(--an-meter-acoustic)" },
];

/** Closest the marker's centre gets to an edge of the plot, as a fraction of its width. */
const MARKER_INSET = 0.03;

/** How many tags get a pill. The rest are named once underneath. */
const TAG_SHOWN = 6;
/**
 * How many of the strongest tags are drawn hot. Always the top three, not a score threshold.
 *
 * Mood tags are scored one at a time, each against "not this mood", so on most tracks every one
 * sits well under half. A 50% line lit nothing at all on Smile Funk, whose strongest tags were 28%,
 * and the legend promised something the page never did. The top three are always the three that
 * best describe the track, which is what the highlight is for.
 */
const TAG_HOT_COUNT = 3;

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
  // The six strongest, always. A fixed score floor left tracks whose tags all sit low with no
  // pills at all, which reads as "no moods" rather than "nothing the model is sure of".
  const tags = [...(s.moodThemeTop ?? [])].sort((a, b) => b.score - a.score);
  const shown = tags.slice(0, TAG_SHOWN);
  const hidden = tags.slice(TAG_SHOWN);

  // Valence and arousal are −1…+1; the plot is 0…1 from the bottom-left.
  //
  // Clamped a hair off each edge, because the marker is centred on its position: an extreme score
  // would otherwise hang half of the dot outside the square. The shift is under one percent of the
  // plot, far smaller than the model's own confidence.
  const clamp = (v: number) => Math.min(1 - MARKER_INSET, Math.max(MARKER_INSET, v));
  const x = clamp((s.valence + 1) / 2);
  const y = clamp((s.arousal + 1) / 2);
  // The caption sits on whichever side of the dot has room. On a bright track the dot is near the
  // right edge, and a caption pinned to its right ran outside the plot — obvious on a phone, where
  // the square is only as wide as the screen.
  const captionLeftOfDot = x > 0.5;

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
          {/* Arousal runs up the y axis and valence along the x, so the four words belong on the
              EDGES they name, not in the corners, where they read as quadrant names instead. */}
          <span aria-hidden="true" className="absolute inset-x-[var(--px-12)] top-1/2 h-px bg-[var(--an-grid)]" />
          <span aria-hidden="true" className="absolute inset-y-[var(--px-12)] left-1/2 w-px bg-[var(--an-grid)]" />
          <AxisLabel className="left-1/2 top-[var(--px-10)] -translate-x-1/2" label="energetic" />
          <AxisLabel className="left-1/2 bottom-[var(--px-10)] -translate-x-1/2" label="calm" />
          <AxisLabel className="left-[var(--px-10)] top-1/2 -translate-y-1/2" label="dark" />
          <AxisLabel className="right-[var(--px-10)] top-1/2 -translate-y-1/2" label="bright" />
          <span
            className="absolute h-[var(--px-14)] w-[var(--px-14)] -translate-x-1/2 translate-y-1/2 rounded-full bg-[var(--an-accent)]"
            style={{
              left: `${x * 100}%`,
              bottom: `${y * 100}%`,
              boxShadow: "0 0 0 6px color-mix(in srgb, var(--an-accent) 13%, transparent)",
            }}
          >
            <span
              className={[
                "absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-fira",
                "text-[length:var(--px-10)] text-[var(--an-text-secondary)]",
                captionLeftOfDot ? "right-[var(--px-18)]" : "left-[var(--px-18)]",
              ].join(" ")}
            >
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
                  className="grid min-h-[var(--px-52)] grid-cols-[var(--px-110)_minmax(0,1fr)_var(--px-36)] items-center gap-[var(--px-10)] border-b border-[var(--an-rule)] py-[var(--px-8)]"
                >
                  <span className="flex min-w-0 flex-col gap-[var(--px-2)]">
                    <span className="font-helvetica text-[length:var(--px-12)] text-[var(--an-text)]">{m.label}</span>
                    <span className="font-fira text-[length:var(--px-9)] leading-tight text-[var(--an-text-muted)]">
                      {m.sub}
                    </span>
                  </span>
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
              <span className="font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)]">
                size = confidence · top three highlighted
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-[var(--px-6)]">
              {shown.map((t, i) => {
                const hot = i < TAG_HOT_COUNT;
                // Size carries the score, so the strongest tags read first without a legend.
                const size = 12 + Math.round(Math.min(1, Math.max(0, t.score)) * 6);
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
                hidden: {hidden.map((t) => `${t.label}\u00a0${Math.round(t.score * 100)}`).join(" · ")}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

const AxisLabel: React.FC<{ className: string; label: string }> = ({ className, label }) => (
  <span
    className={`absolute font-fira text-[length:var(--px-10)] uppercase tracking-[0.08em] text-[var(--an-text-secondary)] ${className}`}
  >
    {label}
  </span>
);
