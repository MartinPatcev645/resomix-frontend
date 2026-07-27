import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllPlaylists } from "@resomix/api-client";
import { displayArtistOrOmit, sanitizeWorkspaceTitle } from "@/utils/trackUtils.ts";
import { useRecentAnalyses } from "@/pages/analysis/useRecentAnalyses.ts";

interface RailPlaylist {
  uuid: string;
  name: string;
  trackCount: number;
  createdAt: string;
}

function relativeWhen(iso: string): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const panelClass =
  "border border-dotted border-slate-200 bg-[rgba(255,255,255,.02)] px-[var(--px-18)] py-[var(--px-16)]";

const headingClass =
  "mb-[var(--px-8)] font-fira text-[length:var(--px-10)] font-medium uppercase tracking-[var(--px-2)] text-[var(--color-primary)] opacity-75";

const itemBtnClass =
  "block w-full py-[var(--px-8)] text-left text-[length:var(--px-13)] font-helvetica font-light text-[var(--color-primary)] opacity-80 transition-opacity hover:opacity-100 min-h-[var(--px-44)]";

const metaClass =
  "mt-[var(--px-2)] block font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--color-primary)] opacity-45";

/**
 * Variant A signed-in rail — recent similarity playlists, recent analyses, Library link.
 * Hidden below 1024px and when signed out (parent controls visibility).
 */
export const WorkspaceRail: React.FC = () => {
  const navigate = useNavigate();
  const { items: analyses } = useRecentAnalyses(true, 5);
  const [playlists, setPlaylists] = useState<RailPlaylist[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await getAllPlaylists({ page: 1, page_size: 5 });
        if (cancelled || !resp.success || !Array.isArray(resp.data)) return;
        setPlaylists(
          resp.data.map((p: Record<string, unknown>) => ({
            uuid: String(p.uuid || p.id),
            name: String(p.name || "Untitled"),
            trackCount: Number(p.num_tracks ?? p.track_count ?? 0),
            createdAt: String(p.created_at || ""),
          })),
        );
      } catch {
        /* non-fatal — rail stays sparse */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="hidden lg:block" aria-label="Recent work">
      <div className="space-y-[var(--px-16)]">
        <div className={panelClass}>
          <h2 className={headingClass}>Similarity playlists</h2>
          {playlists.length === 0 ? (
            <p className="font-fira text-[length:var(--px-10)] opacity-45">No playlists yet.</p>
          ) : (
            <ul className="divide-y divide-dotted divide-slate-200">
              {playlists.map((p) => (
                <li key={p.uuid}>
                  <button
                    type="button"
                    className={itemBtnClass}
                    onClick={() => navigate(`/sonic-discovery?id=${p.uuid}`)}
                  >
                    {p.name}
                    <span className={metaClass}>
                      {p.trackCount} track{p.trackCount === 1 ? "" : "s"}
                      {p.createdAt ? ` · ${relativeWhen(p.createdAt)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={panelClass}>
          <h2 className={headingClass}>Recent analyses</h2>
          {analyses.length === 0 ? (
            <p className="font-fira text-[length:var(--px-10)] opacity-45">No analyses yet.</p>
          ) : (
            <ul className="divide-y divide-dotted divide-slate-200">
              {analyses.map((a) => (
                <li key={a.analysisUuid}>
                  <button
                    type="button"
                    className={itemBtnClass}
                    onClick={() => navigate(`/analysis?id=${a.analysisUuid}`)}
                  >
                    {sanitizeWorkspaceTitle(a.title)}
                    <span className={metaClass}>
                      Completed
                      {displayArtistOrOmit(a.artist) ? ` · ${displayArtistOrOmit(a.artist)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={panelClass}>
          <h2 className={headingClass}>Library</h2>
          <ul>
            <li>
              <button type="button" className={itemBtnClass} onClick={() => navigate("/library")}>
                Open your Library
                <span className={metaClass}>Rename · share · export</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};
