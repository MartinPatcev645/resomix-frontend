import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useGlobalAudioController } from "@resomix/hooks";

/**
 * Stop playback whenever the user navigates to a different page or a different playlist.
 *
 * Playback state (`isPlaying`, the controller's current track, the audio elements themselves) lives
 * in a global store that outlives any route, and nothing used to clear it on navigation. So:
 * play a reference track, go back to the Library, open a DIFFERENT playlist — and the new hero
 * came up showing a pause button over the previous track's progress, because the old state was
 * still standing. You then had to press pause and play again to start the track you were actually
 * looking at.
 *
 * Arriving on a playlist should always offer Play. `stop()` is what makes that true: it pauses both
 * the HLS and preview elements, clears `isPlaying`, and drops the media-session state.
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
  const controller = useGlobalAudioController();

  // Identity of "where we are": the page, plus which playlist is open on it.
  const routeKey = `${location.pathname}?${new URLSearchParams(location.search).get("id") ?? ""}`;
  const previousRouteKey = useRef<string | null>(null);

  useEffect(() => {
    const isFirstRun = previousRouteKey.current === null;
    const moved = previousRouteKey.current !== routeKey;
    previousRouteKey.current = routeKey;

    if (isFirstRun || !moved) return;
    controller?.stop();
  }, [routeKey, controller]);
}

export default useStopPlaybackOnNavigate;
