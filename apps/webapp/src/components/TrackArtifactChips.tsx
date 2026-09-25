import type { ArtifactState, LibraryTrack } from "@resomix/stores";
import { shouldOpenInNewTab } from "@resomix/hooks";

/**
 * Sibling-artifact state now comes from the backend (`track_artifact_status`), not from the row's
 * age.
 *
 * What it replaced: a track younger than 15 minutes with a missing artifact was called
 * "generating"; anything older was called "Analysis coming soon". So an analysis that took longer
 * than 15 minutes was reported to the user as an unbuilt feature while it was actively running,
 * and a failed one was indistinguishable from a healthy one. The window could not be widened out
 * of the problem either — it is a guess in both directions.
 */
const stateOf = (t: LibraryTrack, side: "playlist" | "analysis"): ArtifactState => {
  // The uuid still wins. If the artifact is there it is openable, whatever the bookkeeping says —
  // a status write can be lost (worker killed between building the artifact and recording it) and
  // that must never hide a playlist the user can actually open.
  if (side === "playlist" ? !!t.playlist_uuid : !!t.analysis_uuid) return "ready";
  return t.artifacts?.[side]?.state ?? "unknown";
};

const errorOf = (t: LibraryTrack, side: "playlist" | "analysis"): string | null =>
  t.artifacts?.[side]?.error ?? null;

/** Still working. Anything else is terminal — this is what stops the Library polling forever. */
const IN_FLIGHT: ArtifactState[] = ["pending", "processing"];

// True while at least one sibling is still expected to arrive — drives the Library's poll. It is
// now the real state that terminates the poll, so a slow analysis keeps polling for as long as it
// genuinely takes, and a finished or failed one stops immediately rather than at a fixed deadline.
export const trackHasPendingArtifact = (t: LibraryTrack): boolean =>
  IN_FLIGHT.includes(stateOf(t, "playlist")) || IN_FLIGHT.includes(stateOf(t, "analysis"));

type CapsuleState = "ready" | "pending" | "muted" | "failed";

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
    // Muted rather than red: this is a per-track outcome the user can do nothing about from here,
    // and a row of alarm-coloured capsules across a Library page reads as "the product is broken"
    // when the truth is "one of these tracks did not analyse".
    failed:
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

// Shown when the pipeline gave no reason of its own. The backend writes a display string for most
// terminal outcomes; these cover the rest, including rows that predate the status table.
const FALLBACK_TEXT: Record<"playlist" | "analysis", string> = {
  playlist: "We could not find close enough matches for this track.",
  analysis: "Analysis is not available for this track.",
};

// The one message the reported bug was about. Kept for tracks with genuinely no pipeline — never
// reachable from `processing` any more, which is the fix.
const COMING_SOON_TITLE = "Analysis coming soon";

// Names the reason rather than saying "upgrade". A user who has been shown their five most recent
// playlists needs to know the sixth still exists and why it is not open, or the Library looks like
// it lost their work.
const LOCKED_PLAYLIST_MESSAGE =
  "This playlist is outside your most recent 5. Upgrade to keep every playlist open.";

/**
 * The two artifact capsules shown on every Library track row. Each track gets a Sonic Discovery
 * (similarity playlist) capsule and an Analysis capsule, so both artifacts are reachable straight
 * from the Library.
 *
 * A capsule now renders from the backend's state rather than from the row's age:
 *   - ready                   → active, navigates to the artifact
 *   - pending / processing    → spinner; the page polls until it becomes terminal
 *   - failed / unavailable    → muted and clickable, explaining what happened
 *   - unknown                 → the old "Analyze — coming soon" affordance
 */
export function TrackArtifactChips({
  track,
  onOpenPlaylist,
  onOpenAnalysis,
  onComingSoon,
  onArtifactNotice,
  layout = "inline",
}: {
  track: LibraryTrack;
  onOpenPlaylist: (uuid: string) => void;
  onOpenAnalysis: (uuid: string) => void;
  onComingSoon: () => void;
  /**
   * Explains a terminal non-ready state when the capsule is clicked. Optional so existing callers
   * keep compiling; without it a failed capsule simply falls back to the coming-soon notice.
   */
  onArtifactNotice?: (message: string) => void;
  /**
   * "inline"  — capsules sit side-by-side in the row's action cluster (desktop).
   * "stacked" — each capsule is a full-width row of its own (mobile bottom-of-card,
   *             like the MoreMenu button rows), so long labels can never overflow.
   */
  layout?: "inline" | "stacked";
}) {
  const stacked = layout === "stacked";
  const playlistState = stateOf(track, "playlist");
  const analysisState = stateOf(track, "analysis");

  const notice = (side: "playlist" | "analysis") => () =>
    (onArtifactNotice ?? onComingSoon)(errorOf(track, side) || FALLBACK_TEXT[side]);

  return (
    <div
      className={
        stacked
          ? "flex flex-col gap-[var(--px-8)] w-full"
          : "flex items-center gap-[var(--px-8)] flex-wrap justify-end"
      }
    >
      {/* Sonic Discovery (similarity playlist) */}
      {playlistState === "ready" && track.playlist_locked ? (
        // Built, and out of reach: beyond the plan's Library cap. Not an error and not a failure —
        // the playlist is fine, the plan is the limit — so it gets the upgrade prompt rather than
        // the "no matches" copy. Rendered as a button with no `href`, because the uuid needed to
        // build one was withheld by the backend; that withholding is the actual gate.
        <Capsule
          state="failed"
          label="Sonic Discovery"
          icon={<PlaylistIcon />}
          title={LOCKED_PLAYLIST_MESSAGE}
          onClick={() => (onArtifactNotice ?? onComingSoon)(LOCKED_PLAYLIST_MESSAGE)}
          fullWidth={stacked}
        />
      ) : playlistState === "ready" ? (
        <Capsule
          state="ready"
          label="Sonic Discovery"
          icon={<PlaylistIcon />}
          title="Open the similarity playlist for this track"
          href={`/sonic-discovery?id=${track.playlist_uuid}`}
          onClick={() => onOpenPlaylist(track.playlist_uuid as string)}
          fullWidth={stacked}
        />
      ) : IN_FLIGHT.includes(playlistState) ? (
        <Capsule state="pending" label="Finding matches…" icon={<Spinner />} title="Building your Sonic Discovery playlist" fullWidth={stacked} />
      ) : playlistState === "unknown" ? (
        // No record either way. Same as before: say nothing rather than invent an outcome.
        null
      ) : (
        <Capsule
          state="failed"
          label="No matches"
          icon={<PlaylistIcon />}
          title={errorOf(track, "playlist") || FALLBACK_TEXT.playlist}
          onClick={notice("playlist")}
          fullWidth={stacked}
        />
      )}

      {/* Analysis */}
      {analysisState === "ready" ? (
        <Capsule
          state="ready"
          label="Analysis"
          icon={<AnalysisIcon />}
          title="Open the analysis for this track"
          href={`/track-intelligence?id=${track.analysis_uuid}`}
          onClick={() => onOpenAnalysis(track.analysis_uuid as string)}
          fullWidth={stacked}
        />
      ) : IN_FLIGHT.includes(analysisState) ? (
        <Capsule state="pending" label="Analyzing…" icon={<Spinner />} title="Analyzing your track" fullWidth={stacked} />
      ) : analysisState === "unknown" ? (
        <Capsule state="muted" label="Analyze" icon={<AnalysisIcon />} title={COMING_SOON_TITLE} onClick={onComingSoon} fullWidth={stacked} />
      ) : (
        <Capsule
          state="failed"
          label="Not analysed"
          icon={<AnalysisIcon />}
          title={errorOf(track, "analysis") || FALLBACK_TEXT.analysis}
          onClick={notice("analysis")}
          fullWidth={stacked}
        />
      )}
    </div>
  );
}
