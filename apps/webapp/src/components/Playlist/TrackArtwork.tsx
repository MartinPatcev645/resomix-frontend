import TrackSvg from "@/assets/icons/track_2.svg";

/**
 * A track's cover in a dotted box: shows the Apple `artwork_url` when present, otherwise a music
 * icon (matching the app's dotted-box-with-icon pattern). Used per track on the playlist screen,
 * desktop + mobile. Pass sizing via `className` (e.g. "w-[var(--px-40)] h-[var(--px-40)]").
 */
export function TrackArtwork({
  artworkUrl,
  className = "",
}: {
  artworkUrl?: string | null;
  className?: string;
}) {
  return (
    <div
      className={`flex-shrink-0 border border-solid border-[var(--playlist-divider)] bg-black/40 flex items-center justify-center overflow-hidden ${className}`.trim()}
    >
      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt=""
          draggable={false}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <img src={TrackSvg} alt="" aria-hidden="true" draggable={false} className="w-1/2 h-1/2 opacity-80" />
      )}
    </div>
  );
}

export default TrackArtwork;
