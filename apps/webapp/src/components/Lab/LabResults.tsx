import type { LabPlaylist, LabTrack } from "@resomix/api-client";
import type { SimilarityLabState } from "@resomix/hooks";
import { PAGE_KICKER, PAGE_PANEL, PAGE_PANEL_PLAIN, PAGE_ROW_META, PAGE_ROW_TITLE, PAGE_SUBLABEL } from "@resomix/ui";
import PlayWhiteSvg from "@/assets/icons/play_white.svg";
import PauseWhiteSvg from "@/assets/icons/pause_white.svg";

// Static class names so Tailwind generates them; the column count follows the experiments chosen.
const COLUMNS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

// Readable names for the figures the backend reports. A figure without a name here (from a newer
// experiment) is still shown, under its own key.
const FIGURES: Record<string, string> = {
  candidates_requested: "Candidates asked for",
  first_stage_fetch: "First-stage asked for",
  first_stage_returned: "First-stage returned",
  search_depth: "Search depth",
  copies_removed: "Copies removed",
  distinct_after_copy_removal: "Distinct after removal",
  shortlist_for_reranking: "Shortlist for re-ranking",
  returned_by_engine: "Returned by the engine",
  in_playlist: "In the playlist",
  engine_ms: "Engine time, ms",
};

function percent(value: number | null): string {
  return value === null ? "" : `${Math.round(value * 100)}%`;
}

function TrackRow({
  track,
  rowKey,
  playing,
  onToggle,
  showOverlap,
}: {
  track: LabTrack;
  rowKey: string;
  playing: boolean;
  onToggle: (t: LabTrack, key: string) => void;
  showOverlap: boolean;
}) {
  return (
    <li className="flex items-center gap-[var(--px-10)] border-b border-dotted border-[var(--rx-color-border-subtle)] py-[var(--px-6)]">
      <span className="w-[var(--px-24)] shrink-0 font-fira text-[length:var(--px-10)] text-[var(--rx-color-text-muted)] tabular-nums">
        {track.rank}
      </span>
      <button
        type="button"
        onClick={() => onToggle(track, rowKey)}
        disabled={!track.preview_url}
        aria-label={playing ? "Stop preview" : "Play preview"}
        className="relative flex h-[var(--px-36)] w-[var(--px-36)] shrink-0 cursor-pointer items-center justify-center overflow-hidden border-0 bg-[var(--rx-color-surface)] p-0 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {track.artwork_url ? (
          <img src={track.artwork_url} alt="" aria-hidden="true" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : null}
        <img
          src={playing ? PauseWhiteSvg : PlayWhiteSvg}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          className="relative h-[var(--px-14)] w-[var(--px-14)]"
        />
      </button>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`${PAGE_ROW_TITLE} truncate text-[var(--rx-color-text-primary)]`}>{track.title ?? track.id}</span>
        <span className={`${PAGE_ROW_META} m-0 truncate`}>
          {[track.artist, track.label, track.year].filter(Boolean).join(" · ")}
        </span>
      </span>
      {showOverlap ? (
        <span
          title={track.in_live ? "Also in today's playlist" : "Not in today's playlist"}
          className={`shrink-0 font-fira text-[length:var(--px-9)] uppercase tracking-[var(--px-1)] ${
            track.in_live ? "text-[var(--rx-color-text-muted)]" : "text-[var(--rx-color-accent)]"
          }`}
        >
          {track.in_live ? "live" : "new"}
        </span>
      ) : null}
      <span className="w-[var(--px-44)] shrink-0 text-right font-fira text-[length:var(--px-10)] text-[var(--rx-color-text-muted)] tabular-nums">
        {typeof track.score === "number" ? track.score.toFixed(3) : ""}
      </span>
    </li>
  );
}

function Column({ playlist, lab }: { playlist: LabPlaylist; lab: SimilarityLabState }) {
  const isLive = playlist.experiment === "live";
  const figures = Object.entries(playlist.diagnostics ?? {});
  return (
    <section className={`${PAGE_PANEL_PLAIN} flex min-w-0 flex-col gap-[var(--px-12)]`}>
      <header className="flex flex-col gap-[var(--px-6)]">
        <span className={PAGE_SUBLABEL}>{isLive ? "Live" : "Experiment"}</span>
        <h2 className={`${PAGE_KICKER}`}>{playlist.label}</h2>
        {!isLive && playlist.same_songs_as_live !== null ? (
          <span className="font-fira text-[length:var(--px-11)] text-[var(--rx-color-text-primary)]">
            Same songs as live, {percent(playlist.same_songs_as_live)}
          </span>
        ) : null}
        {playlist.error ? (
          <span className="font-fira text-[length:var(--px-11)] text-[var(--rx-color-error)]">{playlist.error}</span>
        ) : null}
      </header>

      {figures.length > 0 ? (
        <dl className="m-0 grid grid-cols-2 gap-x-[var(--px-12)] gap-y-[var(--px-4)] border-t border-dotted border-[var(--rx-color-border-subtle)] pt-[var(--px-8)]">
          {figures.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className={PAGE_SUBLABEL}>{FIGURES[key] ?? key}</dt>
              <dd className="m-0 text-right font-fira text-[length:var(--px-10)] text-[var(--rx-color-text-primary)] tabular-nums">
                {value ?? ""}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ol className="m-0 list-none p-0">
        {playlist.tracks.map((t) => {
          const key = `${playlist.experiment}:${t.id}`;
          return (
            <TrackRow
              key={key}
              track={t}
              rowKey={key}
              playing={lab.playingId === key}
              onToggle={lab.togglePreview}
              showOverlap={!isLive}
            />
          );
        })}
      </ol>
    </section>
  );
}

/** The seed and one column per experiment. */
export function LabResults({ lab }: { lab: SimilarityLabState }) {
  const result = lab.comparison;
  if (!result) return null;
  const seed = result.seed;
  return (
    <div className="flex flex-col gap-[var(--px-18)]">
      <section className={`${PAGE_PANEL} flex items-center gap-[var(--px-12)]`}>
        {seed.artwork_url ? (
          <img src={seed.artwork_url} alt="" aria-hidden="true" loading="lazy" draggable={false} className="h-[var(--px-48)] w-[var(--px-48)] object-cover" />
        ) : null}
        <span className="flex min-w-0 flex-col">
          <span className={PAGE_SUBLABEL}>Seed</span>
          <span className={`${PAGE_ROW_TITLE} truncate text-[var(--rx-color-text-primary)]`}>
            {[seed.artist, seed.title].filter(Boolean).join(" - ")}
          </span>
          <span className={`${PAGE_ROW_META} m-0`}>
            {result.top_sk} tracks per playlist · compared in {result.took_ms} ms
          </span>
        </span>
      </section>
      <div className={`grid grid-cols-1 gap-[var(--px-18)] ${COLUMNS[result.playlists.length] ?? "lg:grid-cols-4"}`}>
        {result.playlists.map((p) => (
          <Column key={p.experiment} playlist={p} lab={lab} />
        ))}
      </div>
    </div>
  );
}
