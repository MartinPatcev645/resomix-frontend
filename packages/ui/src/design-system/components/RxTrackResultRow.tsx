import React from "react";
import { RxBadge } from "./RxBadge";
import { RxIconButton } from "./RxIconButton";
import { RxScoreRail } from "./RxScoreRail";

type RxTrackResultRowProps = {
  artworkLabel: string;
  title: string;
  artist: string;
  score: number;
  bpm: number;
  musicalKey: string;
  year: number;
  duration: string;
  state?: "default" | "hover" | "selected" | "playing" | "paused" | "unavailable";
  mobile?: boolean;
  wrapped?: boolean;
  unavailableReason?: string;
  onPlayToggle?: React.MouseEventHandler<HTMLButtonElement>;
  onMoreActions?: React.MouseEventHandler<HTMLButtonElement>;
};

export function RxTrackResultRow({
  artworkLabel,
  title,
  artist,
  score,
  bpm,
  musicalKey,
  year,
  duration,
  state = "default",
  mobile = false,
  wrapped = false,
  unavailableReason,
  onPlayToggle,
  onMoreActions,
}: RxTrackResultRowProps) {
  const isSelected = state === "selected";
  const isPlaying = state === "playing";
  const isPaused = state === "paused";
  const isUnavailable = state === "unavailable";
  const emphasis = isPlaying ? "playing" : isSelected ? "selected" : "default";

  if (mobile) {
    return (
      <article
        className="rx-mobile-row"
        data-wrap={wrapped || undefined}
        data-hovered={state === "hover" || undefined}
        data-selected={isSelected || undefined}
        data-playing={isPlaying || undefined}
        data-paused={isPaused || undefined}
        data-unavailable={isUnavailable || undefined}
        data-state={state}
      >
        <div className="rx-mobile-row__top">
          <RxIconButton
            label={isPlaying ? "Pause preview" : "Play preview"}
            icon={isPlaying ? "II" : ">"}
            active={isPlaying}
            onClick={onPlayToggle}
          />
          <div className="rx-artwork rx-artwork--compact" aria-hidden="true">
            {artworkLabel}
          </div>
          <div className="rx-row__meta" style={{ minWidth: 0, flex: 1 }}>
            <p className="rx-row__title">{title}</p>
            <p className="rx-row__subtitle">{artist}</p>
          </div>
          <RxIconButton label="More actions" icon="..." onClick={onMoreActions} />
        </div>

        <div className="rx-mobile-row__bottom">
          <div className="rx-inline">
            <span className="rx-meta">{bpm} BPM</span>
            <span className="rx-meta">{musicalKey}</span>
            <span className="rx-meta">{year}</span>
            <span className="rx-meta">{duration}</span>
          </div>
          {state === "playing" ? <RxBadge tone="accent">Playing</RxBadge> : null}
          {state === "paused" ? <RxBadge>Paused</RxBadge> : null}
          {state === "selected" ? <RxBadge tone="accent">Selected</RxBadge> : null}
          {isUnavailable && unavailableReason ? <RxBadge tone="error">{unavailableReason}</RxBadge> : null}
        </div>

        <RxScoreRail label="Match score" score={score} emphasis={emphasis} />
      </article>
    );
  }

  return (
    <article
      className="rx-row"
      data-hovered={state === "hover" || undefined}
      data-selected={isSelected || undefined}
      data-playing={isPlaying || undefined}
      data-paused={isPaused || undefined}
      data-unavailable={isUnavailable || undefined}
      data-state={state}
    >
      <div className="rx-row__leading">
        <RxIconButton
          label={isPlaying ? "Pause preview" : "Play preview"}
          icon={isPlaying ? "II" : ">"}
          active={isPlaying}
          onClick={onPlayToggle}
        />
        <div className="rx-artwork" aria-hidden="true">
          {artworkLabel}
        </div>
      </div>

      <div className="rx-row__meta">
        <p className="rx-row__title">{title}</p>
        <p className="rx-row__subtitle">{artist}</p>
      </div>

      <div className="rx-row__meta">
        <RxScoreRail label="Match score" score={score} emphasis={emphasis} />
      </div>

      <div className="rx-row__metrics">
        <div className="rx-row__metric-box">
          <span className="rx-label">BPM</span>
          <p className="rx-row__metric">{bpm}</p>
        </div>
        <div className="rx-row__metric-box">
          <span className="rx-label">Key</span>
          <p className="rx-row__metric">{musicalKey}</p>
        </div>
        <div className="rx-row__metric-box">
          <span className="rx-label">Year</span>
          <p className="rx-row__metric">{year}</p>
        </div>
        <div className="rx-row__metric-box">
          <span className="rx-label">Length</span>
          <p className="rx-row__metric">{duration}</p>
        </div>
      </div>

      <div className="rx-row__status">
        {state === "playing" ? <RxBadge tone="accent">Playing</RxBadge> : null}
        {state === "paused" ? <RxBadge>Paused</RxBadge> : null}
        {state === "selected" ? <RxBadge tone="accent">Selected</RxBadge> : null}
        {state === "unavailable" && unavailableReason ? <RxBadge tone="error">{unavailableReason}</RxBadge> : null}
      </div>

      <div className="rx-row__actions">
        <RxIconButton label="More actions" icon="..." onClick={onMoreActions} />
      </div>
    </article>
  );
}

export type { RxTrackResultRowProps };
