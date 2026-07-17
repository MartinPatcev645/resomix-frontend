import { useEffect } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { getPlaylistSimilarity } from '@resomix/api-client';

/**
 * Loads playlist similarity data for the `?id=` parameter in the URL into the global playlist
 * store so any page can consume it. Checks the localStorage cache before hitting the API.
 *
 * Why it is shaped this way — it must react to the URL `id` CHANGING, not merely to an empty
 * store. The previous version bailed with `if (playlistData) return` and read `id` only inside the
 * effect (never a dependency), so navigating from playlist A → B in the SAME tab kept showing A:
 * the store still held A, so the loader short-circuited and never fetched B. Opening B in a new
 * tab worked only because the store started empty. This version keys on the URL `id` AND the
 * loaded playlist, so it correctly refetches for every distinct scenario:
 *   1. Navigate to a different playlist (mount from the library, or in-place `?id=` swap).
 *   2. Mount while the store still holds a stale, unrelated playlist.
 *   3. Auth change: `useAuth.reset()` empties the store on login while `id` stays the same — we
 *      must refetch the now-unredacted playlist. Keeping `playlistData` in the deps covers this.
 */
export function usePlaylistLoader() {
  const {
    playlistData,
    setPlaylistResponse,
    setLoading,
    setError,
    setPlaylistData,
    clearPlaylistData,
    loadCachedResponse,
    saveResponseToCache,
  } = usePlaylistStore();

  // Read the requested id on every render so the effect re-runs when React Router swaps the route
  // in place — PlaylistPage subscribes to the location via useSearchParams(), so it re-renders on
  // `?id=` changes and this hook re-reads window.location.
  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

  useEffect(() => {
    if (!id) return;

    const loadedId = playlistData?.playlist?.id ?? null;
    if (loadedId === id) return; // the store already holds THIS playlist — nothing to do

    // The store holds a DIFFERENT (stale) playlist. Drop it first so the previous playlist can't
    // keep rendering, then let the resulting store update re-run this effect with an empty store,
    // which takes the fetch branch below. Returning here means exactly one fetch per navigation.
    if (loadedId) {
      clearPlaylistData();
      return;
    }

    // Committing to (re)load this id — clear any stale error from a PREVIOUS playlist so the page
    // shows the loader (not the prior "private" screen) while this one resolves.
    setError(null);

    // Store is empty for this id → load it (cache first, then API).
    let cancelled = false;
    (async () => {
      try {
        const cachedResponse = loadCachedResponse(id);
        if (cachedResponse) {
          if (!cancelled) setPlaylistResponse(cachedResponse);
          return;
        }

        setLoading(true);
        const resp = await getPlaylistSimilarity(id);
        if (cancelled) return;
        setLoading(false);
        if (resp.success) {
          if (resp.data) {
            // API returns the full playlist data under data.
            setPlaylistData(resp.data as any);
            // Persist the freshly fetched data so it replaces any stale entry (e.g. a redacted
            // anonymous teaser the user saw before logging in). saveResponseToCache itself skips
            // redacted responses, so a still-guest refetch is never re-cached.
            saveResponseToCache({ success: true, data: resp.data } as any);
          } else {
            // Fallback to whole response shape.
            setPlaylistResponse(resp as any);
          }
        } else {
          setError(resp.error || 'Failed to load playlist');
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError('Failed to load playlist');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, playlistData, setPlaylistResponse, setLoading, setError, setPlaylistData, clearPlaylistData, loadCachedResponse, saveResponseToCache]);
}
