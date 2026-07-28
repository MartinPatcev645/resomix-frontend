import React from "react";
import { RxIconButton } from "./RxIconButton";

type RxReferenceStripProps = {
  artworkLabel?: string;
  contextLabel?: string;
  title: string;
  artist: string;
  resultCount: number;
  state?: "playing" | "paused";
  onPlayToggle?: React.MouseEventHandler<HTMLButtonElement>;
};

export function RxReferenceStrip({
  artworkLabel = "REF",
  contextLabel = "Similar tracks for this reference",
  title,
  artist,
  resultCount,
  state = "paused",
  onPlayToggle,
}: RxReferenceStripProps) {
  return (
    <div
      className="rx-reference-strip"
      data-playing={state === "playing" || undefined}
      data-state={state}
    >
      <div className="rx-artwork rx-artwork--compact" aria-hidden="true">
        {artworkLabel}
      </div>
      <RxIconButton
        label={state === "playing" ? "Pause reference preview" : "Play reference preview"}
        icon={state === "playing" ? "II" : ">"}
        active={state === "playing"}
        onClick={onPlayToggle}
      />
      <div className="rx-reference-strip__context">
        <p className="rx-meta">{contextLabel}</p>
        <p className="rx-row__title">{title}</p>
        <p className="rx-row__subtitle">{artist}</p>
      </div>
      <div className="rx-meta">{resultCount} results</div>
    </div>
  );
}

export type { RxReferenceStripProps };
