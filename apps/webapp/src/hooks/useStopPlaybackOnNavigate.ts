import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { usePlayerStore } from "@resomix/stores";

/**
 * Stop playback whenever the user navigates to a different page or a different playlist.
 *
 * Playback state (`isPlaying`, the controller's current track, the audio elements themselves) lives
 * in a global singleton that outlives any route. So: play a reference track, go back to the
 * Library, open a DIFFERENT playlist — and the new hero came up showing a pause button over the
 * previous track's progress. You then had to press pause and play again to start the track you
 * were actually looking at. Arriving on a playlist should always offer Play.
 *
 * Reads the controller from the STORE rather than `useGlobalAudioController()`. That hook throws
 * "AudioProvider is missing in the tree" when there is no provider above it, and the provider is
 * mounted deep — inside the playlist pages and the discovery results, far below this shell. Calling
 * it here took the whole app down to a blank page. The store copy is published by AudioProvider
 * itself and is the same singleton, so this sees the controller when one exists and simply does
 * nothing when none has been created — which is correct, since nothing can be playing yet.
 *
 * Scope, deliberately:
 *  • Keyed on pathname + the `id` param, so opening a different playlist counts as navigation
 *    while other query changes on the same page do not.
 *  • Skips the first run — arriving on a page must not stop audio that was never started.
 *  • Route changes ONLY. Tab switches and backgrounding are untouched, because playback is meant
 *    to continue while the tab is in the background; this hook never observes visibility.
 */
export function useStopPlaybackOnNavigate() {
  const location = useLocation();

  // Identity of "where we are": the page, plus which playlist is open on it.
  const routeKey = `${location.pathname}?${new URLSearchParams(location.search).get("id") ?? ""}`;
  const previousRouteKey = useRef<string | null>(null);

  useEffect(() => {
    const isFirstRun = previousRouteKey.current === null;
    const moved = previousRouteKey.current !== routeKey;
    previousRouteKey.current = routeKey;

    if (isFirstRun || !moved) return;
    // Read at fire time, not as a reactive selector: we only care what exists at the moment we
    // navigate, and subscribing would re-run this effect when the controller is first published.
    usePlayerStore.getState().audioController?.stop?.();
  }, [routeKey]);
}

export default useStopPlaybackOnNavigate;
