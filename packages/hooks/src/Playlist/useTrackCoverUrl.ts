import { useEffect, useState } from 'react';
import { getPlaybackToken } from '@resomix/stores';

/**
 * Build the media-server cover-image URL for a track uuid, mirroring how peaks are fetched:
 * `${mediaBase}/cover-image/?uuid=<uuid>&token=<playbackToken>`.
 *
 * The Hetzner media server stores every uploaded track's cover by its uuid (extracted on upload,
 * alongside peaks), so passing the uuid + the existing playback token is all it needs — no cover
 * URL is built server-side. Returns null while the token mints (or when there's no uuid); the
 * caller falls back to the bundled default cover both while loading and if the image 404s (a seed
 * with no embedded art, e.g. a search playlist).
 */
export function useTrackCoverUrl(uuid: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await getPlaybackToken();
      if (cancelled) return;
      const mediaBase = (import.meta as any).env?.VITE_SERVER_MEDIA || 'https://media.resomix.com';
      const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
      setUrl(`${mediaBase}/cover-image/?uuid=${encodeURIComponent(uuid)}${tokenParam}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  return url;
}
