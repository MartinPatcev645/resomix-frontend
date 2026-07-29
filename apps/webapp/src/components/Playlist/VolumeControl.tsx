import SoundLoudSvg from "@/assets/icons/sound_loud.svg";
import SoundMuteSvg from "@/assets/icons/sound_mute.svg";
import SoundLowSvg from "@/assets/icons/sound_low.svg";

interface VolumeControlProps {
  /** Current level, 0–1. */
  volume: number;
  onToggleMute: () => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Pill height — defaults to the hero's 35px; the inline row player runs shorter. */
  heightClass?: string;
  widthClass?: string;
  /** Greys the control out and blocks input (hero uses it while playback is unavailable). */
  dimmed?: boolean;
}

/**
 * Mute toggle + level slider as ONE bordered pill, so volume reads as a single control rather than
 * a button sitting next to a bare rail. Shared by the hero's reference player and the playlist
 * row's inline player, which is why the sizing is a prop rather than baked in.
 */
export function VolumeControl({
  volume,
  onToggleMute,
  onChange,
  heightClass = "h-[var(--px-35)]",
  widthClass = "w-[var(--px-140)]",
  dimmed = false,
}: VolumeControlProps) {
  const iconClass = "h-[var(--px-16)] w-[var(--px-16)] shrink-0";

  return (
    <div
      className={`player-control-volume-group flex ${heightClass} ${widthClass} shrink-0 items-center gap-[var(--px-8)] rounded-[var(--rx-radius-control)] border border-[var(--rx-color-border-default)] px-[var(--px-10)] transition-[border-color] hover:border-[var(--rx-color-border-strong)] ${dimmed ? "pointer-events-none opacity-45" : ""}`}
    >
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        className="flex h-full shrink-0 cursor-pointer items-center justify-center bg-transparent text-[var(--rx-color-text-secondary)] transition-colors hover:text-[var(--rx-color-text-primary)] player-control player-control-mute-toggle pl-focus-ring"
      >
        {volume === 0 ? (
          <img src={SoundMuteSvg} draggable={false} alt="" aria-hidden="true" className={iconClass} />
        ) : volume < 0.5 ? (
          <img src={SoundLowSvg} draggable={false} alt="" aria-hidden="true" className={iconClass} />
        ) : (
          <img src={SoundLoudSvg} draggable={false} alt="" aria-hidden="true" className={iconClass} />
        )}
      </button>
      <div className="relative flex h-full min-w-0 flex-1 items-center">
        <div className="pointer-events-none absolute h-[var(--px-2)] w-full bg-[rgba(255,255,255,0.14)]" />
        {/* Filled portion up to the thumb — the rail alone gave no read of the current level. */}
        <div
          className="pointer-events-none absolute h-[var(--px-2)] bg-[var(--rx-color-text-secondary)]"
          style={{ width: `${Math.round(volume * 100)}%` }}
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={onChange}
          aria-label="Volume"
          className="relative z-10 h-full w-full cursor-pointer appearance-none bg-transparent pl-focus-ring [&::-moz-range-thumb]:h-[var(--px-8)] [&::-moz-range-thumb]:w-[var(--px-2)] [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-none [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:bg-[rgba(255,255,255,0.8)] [&::-moz-range-track]:h-[var(--px-1)] [&::-moz-range-track]:border-none [&::-moz-range-track]:bg-transparent [&::-webkit-slider-thumb]:h-[var(--px-8)] [&::-webkit-slider-thumb]:w-[var(--px-2)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-[rgba(255,255,255,0.8)] [&::-webkit-slider-track]:h-[var(--px-1)] [&::-webkit-slider-track]:rounded-none [&::-webkit-slider-track]:bg-transparent player-control player-control-volume-slider"
        />
      </div>
    </div>
  );
}

export default VolumeControl;
