import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useTrackAnalysis } from "./analysis/useTrackAnalysis.js";
import { AnalysisSummaryCard } from "@/sections/desktop/Workspace/AnalysisSummaryCard.tsx";

/**
 * AnalysisSummaryPage — `/analysis?id=<uuid>`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `?id=` used to open the **full Track Intelligence dashboard**, which had two consequences once
 * the dashboard became Pro-only:
 *
 *   * every link that just means "open this analysis" — the workspace rail, the Library, the track
 *     chips — landed a free user on an upgrade CTA they had not asked for; and
 *   * "back to summary" had nowhere to go, because the summary was not a page.
 *
 * So `?id=` now shows the **summary card** — the thing every plan is entitled to, and the same
 * component the workspace renders straight after an upload. The dashboard moved to
 * `/analysis/full?id=`, reached only by choosing it.
 *
 * The card is rendered from the *projected* payload, so a free user sees exactly what they would
 * have seen in the workspace: BPM, key, energy, structure, the persona blurb, and the link through
 * to their similarity playlist.
 */
export default function AnalysisSummaryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const analysisId = searchParams.get("id");

  const { status, data, error, analysisId: loadedId, playlistUuid, playlistPending, loadById } =
    useTrackAnalysis();

  // Captured once: `location.state` is dropped by later navigations, so reading it lazily would
  // always look like a non-Library visit and mislabel the back link.
  const cameFromLibrary = useMemo(() => location.state?.from === "library", []);

  useEffect(() => {
    if (analysisId) void loadById(analysisId);
  }, [analysisId, loadById]);

  const backHref = cameFromLibrary ? "/library" : "/analysis";

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-[var(--px-56)] lg:px-[var(--px-80)] pb-[var(--px-80)]">
      <div className="mx-auto w-full max-w-4xl text-[var(--color-primary)]">
        <div className="mb-[var(--px-16)]">
          <button
            type="button"
            onClick={() => navigate(backHref)}
            aria-label={cameFromLibrary ? "Back to Library" : "Back to Analysis"}
            className="inline-flex items-center gap-[var(--px-8)] font-fira text-[length:var(--px-10)] font-light uppercase tracking-wide opacity-70 transition-opacity hover:opacity-100 cursor-pointer"
          >
            <svg className="h-[var(--px-12)] w-[var(--px-12)] fill-none stroke-current" strokeWidth="1.8" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {cameFromLibrary ? "Back to Library" : "Back to Analysis"}
          </button>
        </div>

        {!analysisId && (
          <p className="font-helvetica text-[length:var(--px-13)] font-light opacity-70">
            No analysis selected.
          </p>
        )}

        {analysisId && status === "error" && (
          <p className="font-helvetica text-[length:var(--px-13)] font-light opacity-70">
            {error ?? "This analysis is no longer available."}
          </p>
        )}

        {analysisId && status !== "error" && !data && (
          <p className="font-fira text-[length:var(--px-10)] uppercase tracking-[0.14em] opacity-70">
            Loading analysis…
          </p>
        )}

        {data && (
          <AnalysisSummaryCard
            data={data}
            analysisId={loadedId ?? analysisId ?? ""}
            playlistUuid={playlistUuid}
            playlistPending={playlistPending}
            onReset={() => navigate(backHref)}
          />
        )}
      </div>
    </section>
  );
}
