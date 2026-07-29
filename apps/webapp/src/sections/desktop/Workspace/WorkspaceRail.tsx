import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllPlaylists } from "@resomix/api-client";
import { displayArtistOrOmit, sanitizeWorkspaceTitle } from "@/utils/trackUtils.ts";
import { useRecentAnalyses } from "@/pages/analysis/useRecentAnalyses.ts";
import { WORKSPACE_FOCUS_VISIBLE } from "./workspacePanelStyles.ts";
import type { WorkspaceMode } from "./WorkspaceShell.tsx";

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

const primaryPanelClass =
  `border border-[var(--rx-color-border-default)] bg-[var(--rx-color-surface)] px-[var(--px-18)] py-[var(--px-16)]`;

const secondaryPanelClass =
  `border border-[var(--rx-color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-[var(--px-18)] py-[var(--px-16)]`;

const primaryHeadingClass =
  "mb-[var(--px-10)] font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-primary)]";

const secondaryHeadingClass =
  "mb-[var(--px-8)] font-fira text-[length:var(--px-10)] font-medium uppercase tracking-[var(--px-2)] text-[var(--rx-color-text-muted)]";

const itemBtnClass =
  `block w-full py-[var(--px-8)] text-left text-[length:var(--px-13)] font-helvetica font-light text-[var(--rx-color-text-secondary)] transition-colors hover:bg-[rgba(255,255,255,0.035)] hover:text-[var(--rx-color-text-primary)] min-h-[var(--px-44)] ${WORKSPACE_FOCUS_VISIBLE}`;

const activeItemBtnClass =
  `relative block w-full border-l-[length:var(--px-3)] border-l-[var(--rx-color-accent)] bg-[var(--rx-color-selected)] py-[var(--px-8)] pl-[calc(var(--px-8)+var(--px-2))] text-left text-[length:var(--px-13)] font-helvetica font-light text-[var(--rx-color-text-primary)] min-h-[var(--px-44)] ${WORKSPACE_FOCUS_VISIBLE}`;

const metaClass =
  "mt-[var(--px-2)] block font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-muted)]";

// "See more" link under a rail list — white by default, neon on hover, pointer cursor. Opens the
// matching Library tab.
const seeMoreClass =
  `mt-[var(--px-8)] inline-flex items-center gap-[var(--px-6)] py-[var(--px-6)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] text-white transition-colors hover:text-[var(--rx-color-accent)] cursor-pointer ${WORKSPACE_FOCUS_VISIBLE}`;

/**
 * Variant A signed-in rail — recent similarity playlists, recent analyses, Library link.
 * Hidden below 1024px and when signed out (parent controls visibility).
 * Section hierarchy follows the active workspace mode.
 */
export const WorkspaceRail: React.FC<{ mode?: WorkspaceMode }> = ({ mode = "discovery" }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activePlaylistId = searchParams.get("id");
  const { items: analyses } = useRecentAnalyses(true, 5);
  const [playlists, setPlaylists] = useState<RailPlaylist[]>([]);
  const playlistsPrimary = mode === "discovery";

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

  const playlistsPanel = (
    <div className={playlistsPrimary ? primaryPanelClass : secondaryPanelClass}>
      <h2 className={playlistsPrimary ? primaryHeadingClass : secondaryHeadingClass}>
        Similarity playlists
        {playlistsPrimary && playlists.length > 0 ? (
          <span className="ml-[var(--px-8)] font-normal opacity-55">({playlists.length})</span>
        ) : null}
      </h2>
      {playlists.length === 0 ? (
        <p className="font-fira text-[length:var(--px-10)] text-[var(--rx-color-disabled)]">No playlists yet.</p>
      ) : (
        <>
          <ul className={`divide-y divide-solid divide-[var(--playlist-divider)]`}>
            {playlists.map((p) => {
              const isActive = activePlaylistId === p.uuid;
              return (
                <li key={p.uuid}>
                  <button
                    type="button"
                    className={isActive ? activeItemBtnClass : itemBtnClass}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => navigate(`/sonic-discovery?id=${p.uuid}`)}
                  >
                    {p.name}
                    <span className={metaClass}>
                      {p.trackCount} track{p.trackCount === 1 ? "" : "s"}
                      {p.createdAt ? ` · ${relativeWhen(p.createdAt)}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" className={seeMoreClass} onClick={() => navigate("/library?tab=playlists")}>
            See more
          </button>
        </>
      )}
    </div>
  );

  const analysesPanel = (
    <div className={playlistsPrimary ? secondaryPanelClass : primaryPanelClass}>
      <h2 className={playlistsPrimary ? secondaryHeadingClass : primaryHeadingClass}>
        Recent analyses
        {!playlistsPrimary && analyses.length > 0 ? (
          <span className="ml-[var(--px-8)] font-normal opacity-55">({analyses.length})</span>
        ) : null}
      </h2>
      {analyses.length === 0 ? (
        <p className="font-fira text-[length:var(--px-10)] text-[var(--rx-color-disabled)]">No analyses yet.</p>
      ) : (
        <>
          <ul className={`divide-y divide-solid divide-[var(--playlist-divider)]`}>
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
          <button type="button" className={seeMoreClass} onClick={() => navigate("/library?tab=tracks")}>
            See more
          </button>
        </>
      )}
    </div>
  );

  return (
    <aside className="hidden lg:block lg:sticky lg:top-[var(--nav-sticky-h)] lg:self-start" aria-label="Recent work">
      <div className="space-y-[var(--px-16)]">
        {playlistsPrimary ? (
          <>
            {playlistsPanel}
            {analysesPanel}
          </>
        ) : (
          <>
            {analysesPanel}
            {playlistsPanel}
          </>
        )}

        <div className={secondaryPanelClass}>
          <h2 className={secondaryHeadingClass}>Library</h2>
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
