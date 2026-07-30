import type { LibraryTrack } from "@resomix/stores";
import { shouldOpenInNewTab } from "@resomix/hooks";

// A sibling artifact (analysis or similarity playlist) is generated in the background right after
// upload and usually lands within a couple of minutes. While a just-uploaded track is still inside
// this window and the artifact is missing, we show a "generating" capsule and poll for it. Past the
// window we stop treating a missing artifact as pending (avoids spinning forever on old/failed rows).
const RECENT_WINDOW_MS = 15 * 60 * 1000;

export const isTrackRecent = (t: LibraryTrack): boolean => {
  if (!t.created_at) return false;
  const ts = new Date(t.created_at).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < RECENT_WINDOW_MS;
};

const playlistReady = (t: LibraryTrack) => !!t.playlist_uuid;
const analysisReady = (t: LibraryTrack) => !!t.analysis_uuid; // the uuid IS the exists signal

// True while at least one sibling is still expected to arrive — drives the Library's 10s poll.
export const trackHasPendingArtifact = (t: LibraryTrack): boolean =>
  isTrackRecent(t) && (!playlistReady(t) || !analysisReady(t));

type CapsuleState = "ready" | "pending" | "muted";

const Spinner = () => (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] animate-spin" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const PlaylistIcon = () => (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current" strokeWidth="1.6" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const AnalysisIcon = () => (
  <svg className="w-[var(--px-12)] h-[var(--px-12)] fill-none stroke-current" strokeWidth="1.6" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v20M17 5v14M22 9v6M7 7v10M2 10v4" />
  </svg>
);

function Capsule({
  state,
  label,
  icon,
  title,
  onClick,
  href,
  fullWidth = false,
}: {
  state: CapsuleState;
  label: string;
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  /** When set, the capsule is a real anchor → right-click / ⌘-click opens the artifact in a new tab. */
  href?: string;
  /** Stacked (mobile) variant: the capsule becomes a full-width row button. */
  fullWidth?: boolean;
}) {
  // Same chrome as the library's Refresh / Filters controls (square token-bordered mono block),
  // just a touch shorter — 30px against their 36px — so the row's capsules stay secondary to it.
  // The stacked mobile variant keeps the full 36px for a comfortable tap target.
  const base =
    "inline-flex items-center gap-[var(--px-6)] whitespace-nowrap rounded-[var(--rx-radius-control)] border " +
    "px-[var(--px-14)] font-fira text-[length:var(--px-10)] uppercase tracking-[var(--px-1)] select-none " +
    "transition-[background-color,border-color,color] duration-[var(--rx-duration-base)] " +
    (fullWidth ? "w-full justify-center min-h-[var(--px-36)]" : "min-h-[var(--px-30)]");
  const byState: Record<CapsuleState, string> = {
    ready:
      "border-[var(--rx-color-border-default)] text-[var(--rx-color-text-primary)] hover:border-[var(--rx-color-border-strong)] hover:bg-[rgba(255,255,255,0.06)] cursor-pointer",
    pending:
      "border-[var(--rx-color-border-subtle)] text-[var(--rx-color-disabled)] cursor-default animate-pulse",
    muted:
      "border-[var(--rx-color-border-subtle)] text-[var(--rx-color-text-muted)] opacity-60 hover:opacity-100 cursor-pointer",
  };
  const inner = (
    <>
      <span className="flex-shrink-0 flex items-center justify-center">{icon}</span>
      <span className="leading-none">{label}</span>
    </>
  );

  // Navigable (href) → anchor, so the browser handles ⌘/Ctrl-click + "Open in new tab"; a plain
  // click is intercepted for SPA nav. Non-navigable states (pending/muted "Analyze") stay buttons.
  if (href) {
    return (
      <a
        href={href}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          if (shouldOpenInNewTab(e)) return; // let the browser open a new tab/window
          e.preventDefault();
          onClick?.();
        }}
        className={`${base} ${byState[state]}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      disabled={state === "pending"}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`${base} ${byState[state]}`}
    >
      {inner}
    </button>
  );
}

/**
 * The two artifact capsules shown on every Library track row. Each track gets a Sonic Discovery
 * (similarity playlist) capsule and an Analysis capsule, so both artifacts are reachable straight
 * from the Library. A capsule is:
 *   - ready   → active, navigates to the artifact
 *   - pending → "…generating" (recent upload, sibling still running; the page polls for it)
 *   - muted   → nothing yet and not recent (analysis: "Analyze" coming-soon; playlist: hidden)
 */
export function TrackArtifactChips({
  track,
  onOpenPlaylist,
  onOpenAnalysis,
  onComingSoon,
  layout = "inline",
}: {
  track: LibraryTrack;
  onOpenPlaylist: (uuid: string) => void;
  onOpenAnalysis: (uuid: string) => void;
  onComingSoon: () => void;
  /**
   * "inline"  — capsules sit side-by-side in the row's action cluster (desktop).
   * "stacked" — each capsule is a full-width row of its own (mobile bottom-of-card,
   *             like the MoreMenu button rows), so long labels can never overflow.
   */
  layout?: "inline" | "stacked";
}) {
  const recent = isTrackRecent(track);
  const stacked = layout === "stacked";

  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-[var(--px-8)] w-full"
          : "flex items-center gap-[var(--px-8)] flex-wrap justify-end"
      }
    >
      {/* Sonic Discovery (similarity playlist) */}
      {playlistReady(track) ? (
        <Capsule
          state="ready"
          label="Sonic Discovery"
          icon={<PlaylistIcon />}
          title="Open the similarity playlist for this track"
          href={`/sonic-discovery?id=${track.playlist_uuid}`}
          onClick={() => onOpenPlaylist(track.playlist_uuid as string)}
          fullWidth={stacked}
        />
      ) : recent ? (
        <Capsule state="pending" label="Finding matches…" icon={<Spinner />} title="Building your Sonic Discovery playlist" fullWidth={stacked} />
      ) : null}

      {/* Analysis */}
      {analysisReady(track) ? (
        <Capsule
          state="ready"
          label="Analysis"
          icon={<AnalysisIcon />}
          title="Open the analysis for this track"
          href={`/analysis?id=${track.analysis_uuid}`}
          onClick={() => onOpenAnalysis(track.analysis_uuid as string)}
          fullWidth={stacked}
        />
      ) : recent ? (
        <Capsule state="pending" label="Analyzing…" icon={<Spinner />} title="Analyzing your track" fullWidth={stacked} />
      ) : (
        <Capsule state="muted" label="Analyze" icon={<AnalysisIcon />} title="Analysis coming soon" onClick={onComingSoon} fullWidth={stacked} />
      )}
    </div>
  );
}
