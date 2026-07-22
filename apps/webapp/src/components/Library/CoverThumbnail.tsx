import React from "react";
import { useTrackCoverUrl } from "@resomix/hooks";
import DefaultCover from "@/assets/default-playlist-cover.jpg";

interface CoverThumbnailProps {
  /** Track uuid — the media server stores/serves the cover under this (uploaded track, playlist
   *  seed, …). */
  uuid?: string | null;
  className?: string;
}

/**
 * Cover thumbnail for a track uuid. Fetches the track's persisted cover from the media server by
 * uuid + playback token (same pattern as peaks; token from the global store) and falls back to the
 * bundled Resomix default while loading, when there's no uuid, or if the image 404s (a track with
 * no embedded art / a search-based playlist seed).
 *
 * A component (not inline in a list `.map`) so each row can call the hook. Used for both library
 * playlist rows (seed track) and library track rows.
 */
export const CoverThumbnail: React.FC<CoverThumbnailProps> = ({ uuid, className }) => {
  const url = useTrackCoverUrl(uuid);
  return (
    <img
      src={url || DefaultCover}
      onError={(e) => { e.currentTarget.src = DefaultCover; }}
      draggable={false}
      alt="Cover"
      className={className}
    />
  );
};

export default CoverThumbnail;
