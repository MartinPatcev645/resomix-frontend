import { useEffect } from 'react';
import { usePlaylistStore } from '@resomix/stores';
import { getPlaylistSimilarity } from '@resomix/api-client';

/**
 * In-flight request de-dupe, keyed by playlist id.
 *
 * React StrictMode double-invokes effects in development (mount → cleanup → mount), and each invoke
 * would otherwise fire its own network request before the cleanup can cancel it — two identical
 * `/playlists/similarity/{id}` calls. Sharing a single in-flight promise per id collapses those (and
 * any transient double-mount) into ONE request. The entry is cleared as soon as the request settles,
 * so a genuine later arrival (or refresh) still fetches fresh.
 */
const inFlight = new Map<string, Promise<any>>();

function loadSimilarityOnce(id: string): Promise<any> {
  let promise = inFlight.get(id);
  if (!promise) {
    promise = getPlaylistSimilarity(id).finally(() => {
      inFlight.delete(id);
    });
    inFlight.set(id, promise);
  }
  return promise;
}

/**
 * Loads the playlist for the URL `?id=` into the global store.
 *
 * ALWAYS fetches fresh from the backend — on arrival, on every `?id=` change, and on a page refresh
 * (which remounts). The playlist is never served from a client cache or from whatever the store
 * happens to still hold (e.g. a guest preview from before login). The fresh response REPLACES the
 * store contents.
 *
 * While a fetch is in flight we clear the current playlist and raise the loading flag, so the page
 * shows its loader (both pages render `playlistData ? content : loader`) instead of stale data —
 * until the fresh response lands and re-populates the store.
 *
 * Fetch-once-per-id: the effect depends only on `id`, store actions are read via `getState()` so our
 * own writes never re-run it, and concurrent duplicate requests are de-duped (see `loadSimilarityOnce`).
 */
export function usePlaylistLoader() {
  // Read the requested id on every render so the effect re-runs when React Router swaps the route in
  // place — the playlist pages subscribe to the location via useSearchParams(), so they re-render on
  // `?id=` changes and this hook re-reads window.location.
  const id = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('id') : null;

  useEffect(() => {
    const store = usePlaylistStore.getState();

    if (!id) {
      store.clearPlaylistData();
      return;
    }

    let cancelled = false;

    // Drop any existing (possibly stale / guest-preview) copy and show the loader until the fresh
    // response arrives, then populate the store with it.
    store.clearPlaylistData();
    store.setLoading(true);

    loadSimilarityOnce(id)
      .then((resp) => {
        if (cancelled) return;
        const s = usePlaylistStore.getState();
        s.setLoading(false);
        if (resp.success) {
          if (resp.data) {
            // API returns the full playlist data under `data`.
            s.setPlaylistData(resp.data as any);
          } else {
            // Fallback to the whole-response shape.
            s.setPlaylistResponse(resp as any);
          }
        } else {
          s.setError(resp.error || 'Failed to load playlist');
        }
      })
      .catch(() => {
        if (cancelled) return;
        const s = usePlaylistStore.getState();
        s.setLoading(false);
        s.setError('Failed to load playlist');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);
}
