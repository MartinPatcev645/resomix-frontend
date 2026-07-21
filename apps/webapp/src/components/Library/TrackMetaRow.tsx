import type { LibraryTrack } from "@resomix/stores";
import { trackMetaPairs } from "@resomix/hooks";

/**
 * Labelled key/value meta row for a Library track card (Artist · Uploaded · Genre · BPM · Key ·
 * Album · Label). Pure render — the pair building/skipping logic lives in
 * `@resomix/hooks` (`trackMetaPairs`). Works for both breakpoints: pairs wrap, long values
 * truncate inside their own slot with a hover tooltip.
 */
export function TrackMetaRow({ track }: { track: LibraryTrack }) {
  const pairs = trackMetaPairs(track);
  if (pairs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-[var(--px-14)] gap-y-[var(--px-4)] text-[length:var(--px-10)] font-light font-fira">
      {pairs.map(([k, v]) => (
        <span key={k} className="flex items-center gap-[var(--px-4)] min-w-0">
          <span className="text-white/40 uppercase tracking-[var(--px-0-5)] shrink-0">{k}</span>
          <span className="text-white/75 truncate max-w-[var(--px-160)]" title={v}>{v}</span>
        </span>
      ))}
    </div>
  );
}

export default TrackMetaRow;
