import { useEffect } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { getPlaylistSimilarity } from '@resomix/api-client';

/**
 * Fetches playlist similarity data when the store is empty but an `?id=`
 * parameter exists in the URL. The data is placed into the global playlist
 * store so any page can consume it.
 * 
 * First checks localStorage cache before making API call.
 */
export function usePlaylistLoader() {
  const { playlistData, setPlaylistResponse, setLoading, setError, setPlaylistData, loadCachedResponse, saveResponseToCache } = usePlaylistStore();

  useEffect(() => {
    if (playlistData) return; // already have data

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (!id) return;

    (async () => {
      try {
        // First check cache before API call
        const cachedResponse = loadCachedResponse(id);
        if (cachedResponse) {
          // Found in cache, use cached data
          setPlaylistResponse(cachedResponse);
          return;
        }

        // Not in cache, fetch from API
        setLoading(true);
        const resp = await getPlaylistSimilarity(id);
        setLoading(false);
        if (resp.success) {
          if (resp.data) {
            // API returns the full playlist data under data
            setPlaylistData(resp.data as any);
            // Persist the freshly fetched data so it replaces any stale entry (e.g. a redacted
            // anonymous teaser the user saw before logging in). saveResponseToCache itself skips
            // redacted responses, so a still-guest refetch is never re-cached.
            saveResponseToCache({ success: true, data: resp.data } as any);
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
  }, [playlistData, setPlaylistResponse, setLoading, setError, setPlaylistData, loadCachedResponse, saveResponseToCache]);
}
