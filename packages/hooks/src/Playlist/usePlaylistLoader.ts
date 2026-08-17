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

/**
 * How long after a creation the store's authoritative copy is trusted as a "fresh hand-off". Within
 * this window a load serves that copy (revalidating silently) instead of a visible clear→refetch;
 * outside it, the normal clear→refetch runs so a later revisit never shows stale data.
 */
const FRESH_HANDOFF_MS = 10_000;

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

    // Fresh hand-off: the app JUST created/resolved this exact playlist and already placed the
    // authoritative response in the store (a page/hook called setPlaylistResponse). Keep it on
    // screen — no clear, no loader — and revalidate quietly in the background so any server-only
    // fields still land, swapping in place. This removes the blink where the just-created playlist
    // flashed, blanked to the loader, then showed again. Bounded by FRESH_HANDOFF_MS and revalidated
    // against the store id, so a later revisit (e.g. a guest preview after login) still refetches.
    const isFreshHandoff =
      store.playlistData?.playlist?.id === id &&
      store.lastResolvedId === id &&
      Date.now() - store.lastResolvedAt < FRESH_HANDOFF_MS;

    if (isFreshHandoff) {
      store.setLoading(false);
      loadSimilarityOnce(id)
        .then((resp) => {
          if (cancelled) return;
          const s = usePlaylistStore.getState();
          // Only swap on success; on failure keep the in-store creation copy (never surface an
          // error over already-good data).
          if (resp?.success) {
            if (resp.data) s.setPlaylistData(resp.data as any);
            else s.setPlaylistResponse(resp as any);
          }
        })
        .catch(() => {
          /* keep the in-store copy */
        });
      return () => {
        cancelled = true;
      };
    }

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
          // Carry WHY it failed, not just that it did. Only a real 403 means "private"; a 429,
          // a 5xx or a dropped connection are faults, and showing them as a permissions message
          // sent us hunting a privacy bug that did not exist.
          const status = (resp as { status?: number }).status;
          const reason =
            status === 403 ? 'forbidden' : status === 404 ? 'not_found' : 'failed';
          s.setError(resp.error || 'Failed to load playlist', reason);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const s = usePlaylistStore.getState();
        s.setLoading(false);
        // A thrown request never reached a verdict — it is a fault, never "private".
        s.setError('Failed to load playlist', 'failed');
      });

    return () => {
      cancelled = true;
    };
  }, [id]);
}
