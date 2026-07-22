import { useEffect, useState } from 'react';
import { getPlaybackToken } from '@resomix/stores';

/**
 * Build the media-server CUSTOM playlist cover URL for a playlist uuid, mirroring `useTrackCoverUrl`
 * but hitting `/playlist-cover-image/` (the media server stores an uploaded playlist cover by the
 * PLAYLIST uuid, kept separate from track covers). Returns null when there's no uuid, while the
 * token mints, or when `enabled` is false (no custom cover) — the caller falls back to the seed
 * track cover / bundled default.
 *
 * `bust` is an optional cache-buster: bump it after a re-upload so the same-URL replaced image is
 * re-fetched instead of served from the browser cache.
 */
export function usePlaylistCoverUrl(
  playlistUuid: string | null | undefined,
  enabled: boolean = true,
  bust: number = 0,
): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistUuid || !enabled) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getPlaybackToken();
      if (cancelled) return;
      const mediaBase = (import.meta as any).env?.VITE_SERVER_MEDIA || 'https://media.resomix.com';
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      const bustParam = bust ? `&v=${bust}` : '';
      setUrl(
        `${mediaBase}/playlist-cover-image/?uuid=${encodeURIComponent(playlistUuid)}${tokenParam}${bustParam}`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [playlistUuid, enabled, bust]);

  return url;
}
