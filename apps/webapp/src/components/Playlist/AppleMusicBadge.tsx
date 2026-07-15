import AppleMusicFullBadge from "@/assets/icons/cc/US-UK_Apple_Music_Listen_on_Badge_RGB_072720.svg";
import AppleMusicIcon from "@/assets/icons/cc/apple-music.svg";

/**
 * Apple Music attribution, using Apple's official artwork (unaltered, per their guidelines) and
 * linking to the track's `deep_link_url`:
 *   - default          → just the Apple Music icon (compact, for a track at rest)
 *   - `playing` = true  → the full "Listen on Apple Music" lockup (shown while the track plays)
 * Hover applies to the whole badge: a soft white glow + a slight zoom (no per-text effects).
 * `fullHeightClass` tunes the full lockup's height (e.g. a shorter badge to sit inline in the
 * player's compact control row); it defaults to the standard height used in the hero/table.
 */
interface AppleMusicBadgeProps {
  deepLinkUrl?: string | null;
  playing?: boolean;
  className?: string;
  fullHeightClass?: string;
}

export function AppleMusicBadge({
  deepLinkUrl,
  playing = false,
  className = "",
  fullHeightClass = "h-[var(--px-26)]",
}: AppleMusicBadgeProps) {
  return (
    <a
      href={deepLinkUrl || "https://music.apple.com"}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Listen on Apple Music"
      title="Listen on Apple Music"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center transition-all duration-150 hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.75)] hover:cursor-pointer ${className}`.trim()}
    >
      {playing ? (
        <img
          src={AppleMusicFullBadge}
          alt="Listen on Apple Music"
          draggable={false}
          className={`${fullHeightClass} w-auto`}
        />
      ) : (
        <img
          src={AppleMusicIcon}
          alt="Apple Music"
          draggable={false}
          className="w-[var(--px-22)] h-[var(--px-22)]"
        />
      )}
    </a>
  );
}

export default AppleMusicBadge;
