import { useEffect, useRef } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { getPlaylistSimilarity } from '@resomix/api-client';

/**
 * Fetches playlist similarity data for the `?id=` parameter in the URL and places it into the
 * global playlist store so any page can consume it. First checks localStorage cache before
 * making an API call.
 *
 * IMPORTANT — client-side navigation. This hook must react to the URL `id` CHANGING, not just to
 * an empty store. Previously it bailed with `if (playlistData) return` and read `id` only inside
 * the effect (never a dependency), so navigating from playlist A → B in the SAME tab kept showing
 * A's stale data — the store still held A, so the loader short-circuited and never refetched B.
 * A hard load (new tab) worked only because the store started empty. We now key the fetch on the
 * URL `id`, dedupe in-flight loads with a ref, and only skip when the store already holds THIS id.
 */
export function usePlaylistLoader() {
  const {
    setPlaylistResponse,
    setLoading,
    setError,
    setPlaylistData,
    clearPlaylistData,
    loadCachedResponse,
    saveResponseToCache,
  } = usePlaylistStore();

  // Read the requested id on every render so the effect re-runs when React Router swaps the route
  // in place (the routed page re-renders, this hook re-reads window.location, `id` changes).
  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;
  // Tracks the id we've already started loading, so a store update mid-fetch can't kick off a
  // duplicate request for the same id.
  const requestedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    if (requestedIdRef.current === id) return; // already loading/loaded this exact id

    // Non-reactive read: if the store ALREADY holds this playlist (e.g. we arrived from the
    // similarity results page that set it), keep it — no refetch. Reading via getState() (rather
    // than a dependency) means clearing stale data below won't re-trigger this effect and cancel
    // the fetch it just started.
    const loadedId = usePlaylistStore.getState().playlistData?.playlist?.id ?? null;
    if (loadedId === id) {
      requestedIdRef.current = id;
      return;
    }

    requestedIdRef.current = id;
    let cancelled = false;

    (async () => {
      try {
        // First check cache before API call.
        const cachedResponse = loadCachedResponse(id);
        if (cachedResponse) {
          if (!cancelled) setPlaylistResponse(cachedResponse);
          return;
        }

        // A different playlist than the one in the store was requested and it's not cached: drop
        // the stale one now so the previous playlist can't render while the new one loads. The
        // loaded id is read non-reactively above, so this clear does not re-run the effect.
        if (loadedId && loadedId !== id) clearPlaylistData();

        // Not in cache, fetch from API.
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
          requestedIdRef.current = null; // allow a retry for this id
        }
      } catch (err) {
        if (!cancelled) {
          setLoading(false);
          setError('Failed to load playlist');
          requestedIdRef.current = null; // allow a retry for this id
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, setPlaylistResponse, setLoading, setError, setPlaylistData, clearPlaylistData, loadCachedResponse, saveResponseToCache]);
}
