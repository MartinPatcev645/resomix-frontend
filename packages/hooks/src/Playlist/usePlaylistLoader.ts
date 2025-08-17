import { useEffect } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { getPlaylistSimilarity } from '@resomix/api-client';

/**
 * Fetches playlist similarity data when the store is empty but an `?id=`
 * parameter exists in the URL. The data is placed into the global playlist
 * store so any page can consume it.
 */
export function usePlaylistLoader() {
  const { playlistData, setPlaylistResponse, setLoading, setError, setPlaylistData } = usePlaylistStore();

  useEffect(() => {
    if (playlistData) return; // already have data

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    (async () => {
      try {
        setLoading(true);
        const resp = await getPlaylistSimilarity(id);
        setLoading(false);
        if (resp.success) {
          if (resp.data) {
            // API returns the full playlist data under data
            setPlaylistData(resp.data as any);
          } else {
            // Fallback to whole response shape
            setPlaylistResponse(resp as any);
          }
        } else {
          setError(resp.error || 'Failed to load playlist');
        }
      } catch (err) {
        setLoading(false);
        setError('Failed to load playlist');
      }
    })();
  }, [playlistData, setPlaylistResponse, setLoading, setError, setPlaylistData]);
}
