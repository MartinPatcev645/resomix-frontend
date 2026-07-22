import React from "react";
import { useTrackCoverUrl } from "@resomix/hooks";
import DefaultCover from "@/assets/default-playlist-cover.jpg";

interface PlaylistCoverProps {
  /** Seed track uuid — the media server stores/serves the cover under this. */
  uuid?: string | null;
  className?: string;
}

/**
 * Playlist cover thumbnail. Fetches the seed track's persisted cover from the media server by
 * uuid + playback token (same pattern as peaks; token comes from the global store), and falls back
 * to the bundled Resomix default while loading, when there's no seed uuid, or if the image 404s (a
 * search playlist / a seed with no embedded art).
 *
 * A component (not inline in the list `.map`) so each row can call the hook.
 */
export const PlaylistCover: React.FC<PlaylistCoverProps> = ({ uuid, className }) => {
  const url = useTrackCoverUrl(uuid);
  return (
    <img
      src={url || DefaultCover}
      onError={(e) => { e.currentTarget.src = DefaultCover; }}
      draggable={false}
      alt="Playlist cover"
      className={className}
    />
  );
};

export default PlaylistCover;
