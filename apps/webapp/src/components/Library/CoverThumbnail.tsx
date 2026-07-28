import React from "react";
import { useTrackCoverUrl, usePlaylistCoverUrl } from "@resomix/hooks";
import DefaultCover from "@/assets/default-playlist-cover.jpg";

interface CoverThumbnailProps {
  /** Track uuid — the media server serves the track's own cover under this. Used only for track
   *  rows (e.g. the library tracks tab); ignored for playlist rows (a playlist never uses a track cover). */
  uuid?: string | null;
  /** Playlist uuid — used to fetch the custom playlist cover when `hasCustomCover` is true. */
  playlistUuid?: string | null;
  /** When true, a custom cover was uploaded for this playlist → show it. */
  hasCustomCover?: boolean;
  /** Cache-buster — bump after replacing the cover so the same-URL image is re-fetched, not reused. */
  bust?: number;
  className?: string;
}

/**
 * Cover thumbnail with the same precedence as the playlist hero. Two modes, by which prop is set:
 *   • Playlist rows (playlistUuid set): custom playlist cover (fetched by playlist uuid) → bundled
 *     default. A playlist never falls back to a track's own cover.
 *   • Track rows (uuid only, e.g. the library tracks tab): the track's own cover (fetched by track
 *     uuid) → bundled default.
 * Cover URLs come from the media server (uuid + playback token, like peaks). Falls back to the
 * default while loading, when there's no cover, or if an image 404s.
 *
 * A component (not inline in a list `.map`) so each row can call the hooks.
 */
export const CoverThumbnail: React.FC<CoverThumbnailProps> = ({ uuid, playlistUuid, hasCustomCover, bust, className }) => {
  const seedUrl = useTrackCoverUrl(uuid);
  const customUrl = usePlaylistCoverUrl(playlistUuid, !!hasCustomCover, bust);
  // Playlist context (playlistUuid set): custom playlist cover → default. Track context: track cover → default.
  const url = playlistUuid ? (hasCustomCover ? customUrl : null) : seedUrl;
  return (
    <img
      src={url || DefaultCover}
      onError={(e) => { e.currentTarget.src = DefaultCover; }}
      draggable={false}
      alt="Cover"
      width={120}
      height={120}
      className={["aspect-square", className].filter(Boolean).join(" ")}
    />
  );
};

export default CoverThumbnail;
