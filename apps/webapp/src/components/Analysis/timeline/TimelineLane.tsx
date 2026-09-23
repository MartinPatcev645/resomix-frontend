import React from "react";

/**
 * One row of the Timeline stack: gutter label · chart · right axis.
 *
 * The three columns are fixed (112 / fluid / 44) so every chart on the page starts and ends at the
 * same x, which is the whole point of the tab: one ruler, one playhead, and lanes that can be read
 * against each other. The playhead is drawn once by `TimelineTab` using the same two insets from
 * `.an-lane-stack`, so it cannot drift from the charts it crosses.
 *
 * On a phone the row stacks: the label sits ABOVE the chart, and whatever the right axis would
 * have said moves into `meta` (the handoff's "40 Hz – 16 kHz" line), because a 44px axis column
 * costs more than it tells at 390px.
 */
/**
 * The lane grid itself. Anything that has to line up with the charts — a lane, a heat row, the
 * header line — uses THIS, so there is exactly one definition of where the chart column starts.
 */
export const LANE_GRID =
  "lg:grid lg:grid-cols-[var(--px-112)_minmax(0,1fr)_var(--px-44)] lg:gap-x-[var(--px-12)] lg:gap-y-0";

export const TimelineLane: React.FC<{
  title: string;
  /** Second line in the gutter on desktop, right-hand side of the label row on mobile. */
  meta?: React.ReactNode;
  /** Desktop-only right axis. Rendered top-to-bottom, evenly spaced. */
  axis?: React.ReactNode[];
  /** Extra gutter content under the title, such as the stems legend. */
  gutterExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, meta, axis, gutterExtra, children }) => (
  <div className={`flex flex-col gap-[var(--px-6)] ${LANE_GRID}`}>
    <div className="flex items-baseline justify-between gap-[var(--px-8)] lg:flex-col lg:items-start lg:justify-start lg:gap-[var(--px-4)] lg:pt-[var(--px-2)]">
      <span className="font-fira text-[length:var(--px-10)] font-semibold uppercase tracking-[0.06em] text-[var(--an-text-strong)] lg:text-[length:var(--px-11)]">
        {title}
      </span>
      {meta ? (
        <span className="text-right font-fira text-[length:var(--px-10)] text-[var(--an-text-muted)] lg:text-left">
          {meta}
        </span>
      ) : null}
      {gutterExtra ? <span className="hidden lg:block">{gutterExtra}</span> : null}
    </div>

    <div className="min-w-0">{children}</div>

    <div className="hidden lg:flex lg:flex-col lg:justify-between lg:py-[var(--px-2)]">
      {(axis ?? []).map((t, i) => (
        <span key={i} className="font-fira text-[length:var(--px-9)] leading-none text-[var(--an-text-muted)]">
          {t}
        </span>
      ))}
    </div>
  </div>
);
