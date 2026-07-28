import React from "react";

type RxScoreRailProps = {
  label: string;
  score: number;
  emphasis?: "default" | "selected" | "playing";
  showValue?: boolean;
};

export function RxScoreRail({
  label,
  score,
  emphasis = "default",
  showValue = true,
}: RxScoreRailProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const width = `${clamped}%`;

  return (
    <div className="rx-score-rail" data-emphasis={emphasis} aria-label={label}>
      <div className="rx-score-rail__meta">
        <span className="rx-label">{label}</span>
        {showValue ? (
          <span className="rx-meta" style={{ fontVariantNumeric: "tabular-nums" }}>
            {clamped.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div
        className="rx-score-rail__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(clamped.toFixed(1))}
        aria-valuetext={`${clamped.toFixed(1)} percent`}
      >
        <div className="rx-score-rail__fill" style={{ width }} />
      </div>
    </div>
  );
}

export type { RxScoreRailProps };
