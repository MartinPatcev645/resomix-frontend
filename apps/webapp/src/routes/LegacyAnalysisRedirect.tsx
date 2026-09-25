import { Navigate, useLocation } from "react-router-dom";

/**
 * The old `/analysis` paths, kept alive.
 *
 * The page was called Analysis until September 2026. Every link ever shared in a chat, bookmarked
 * or pasted into an email carries the old path with the analysis id on the end of it, and those
 * have to keep opening the same reading. So both old routes stay declared and send the reader on
 * with the query string and the hash intact, replacing the history entry so Back does not bounce
 * them straight into the redirect again.
 */
export function LegacyAnalysisRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace state={location.state} />;
}

export default LegacyAnalysisRedirect;
