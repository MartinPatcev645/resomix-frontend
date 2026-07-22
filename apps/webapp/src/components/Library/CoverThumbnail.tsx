import React from "react";
import { useTrackCoverUrl, usePlaylistCoverUrl } from "@resomix/hooks";
import DefaultCover from "@/assets/default-playlist-cover.jpg";

interface CoverThumbnailProps {
  /** Track uuid — the media server stores/serves the cover under this (uploaded track, playlist
   *  seed, …). Used as the fallback when there's no custom playlist cover. */
  uuid?: string | null;
  /** Playlist uuid — used to fetch the custom playlist cover when `hasCustomCover` is true. */
  playlistUuid?: string | null;
  /** When true, a custom cover was uploaded → prefer the playlist cover over the seed track cover. */
  hasCustomCover?: boolean;
  className?: string;
}

/**
 * Cover thumbnail with the same precedence as the playlist hero: custom playlist cover (if
 * uploaded, fetched by playlist uuid) → seed track cover (fetched by track uuid) → bundled default.
 * Both cover URLs come from the media server (uuid + playback token, like peaks). Falls back to the
 * default while loading, when there's no uuid, or if an image 404s.
 *
 * A component (not inline in a list `.map`) so each row can call the hooks. Used for library
 * playlist rows (custom cover / seed track) and library track rows (seed uuid only).
 */
export const CoverThumbnail: React.FC<CoverThumbnailProps> = ({ uuid, playlistUuid, hasCustomCover, className }) => {
  const seedUrl = useTrackCoverUrl(uuid);
  const customUrl = usePlaylistCoverUrl(playlistUuid, !!hasCustomCover);
  const url = hasCustomCover ? customUrl : seedUrl;
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
