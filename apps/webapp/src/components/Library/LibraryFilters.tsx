import React, { useEffect, useState } from "react";
import type { LibraryFilters as LibraryFiltersValue } from "@resomix/stores";

type LibraryTab = "playlists" | "favorites" | "tracks";

interface LibraryFiltersProps {
  activeTab: LibraryTab;
  /** The filters currently applied for the active tab — seeds (and re-seeds) the draft. */
  applied: LibraryFiltersValue;
  loading?: boolean;
  onApply: (filters: LibraryFiltersValue) => void;
  onClear: () => void;
  onRefresh: () => void;
}

// "At least N tracks" options for the playlists/favorites tabs (backend treats num_tracks as a minimum).
const NUM_TRACKS_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "10+", value: 10 },
  { label: "20+", value: 20 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
];

const fieldClass =
  "border border-dotted border-white/20 bg-transparent px-[var(--px-10)] py-[var(--px-6)] text-[length:var(--px-12)] font-fira text-white/90 rounded-xs focus:border-white/50 outline-none";
const labelClass =
  "text-[length:var(--px-9)] uppercase tracking-wide text-white/40 font-fira mb-[var(--px-4)]";
const btnBase =
  "flex items-center gap-[var(--px-8)] px-[var(--px-14)] py-[var(--px-6)] border border-dotted text-[length:var(--px-12)] font-fira tracking-wide uppercase transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 rounded-xs";

/**
 * Library filter bar (search / date range / min-tracks) plus Apply, Clear and Refresh.
 * Holds an uncommitted DRAFT; the parent only sees the values on Apply (or the reset on Clear),
 * so typing never re-queries the backend. The draft re-seeds from `applied` whenever it changes
 * (tab switch, or after an Apply/Clear), keeping the inputs in sync with what's actually applied.
 */
export const LibraryFilters: React.FC<LibraryFiltersProps> = ({
  activeTab,
  applied,
  loading = false,
  onApply,
  onClear,
  onRefresh,
}) => {
  const [draft, setDraft] = useState<LibraryFiltersValue>(applied);

  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  const isTracks = activeTab === "tracks";
  const searchPlaceholder = isTracks
    ? "Search title, artist, or ID"
    : "Search name or ID";

  const set = (patch: Partial<LibraryFiltersValue>) => setDraft((d) => ({ ...d, ...patch }));

  const hasContent = (f: LibraryFiltersValue) =>
    Boolean(f.search.trim() || f.startDate || f.endDate || f.numTracks);
  // Apply only makes sense once the user has entered something; Clear only when there's
  // something to clear — either an unapplied draft OR filters currently applied.
  const draftHasContent = hasContent(draft);
  const applyDisabled = loading || !draftHasContent;
  const clearDisabled = loading || (!draftHasContent && !hasContent(applied));

  return (
    <div className="mb-[var(--px-15)] flex flex-wrap items-end gap-[var(--px-10)]">
      {/* Search */}
      <div className="flex flex-col min-w-[var(--px-160)] flex-grow md:flex-grow-0 md:w-[var(--px-240)]">
        <label htmlFor="library-filter-search" className={labelClass}>Search</label>
        <input
          id="library-filter-search"
          type="text"
          value={draft.search}
          placeholder={searchPlaceholder}
          onChange={(e) => set({ search: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") onApply(draft); }}
          className={`${fieldClass} w-full`}
        />
      </div>

      {/* Date range */}
      <div className="flex flex-col">
        <label htmlFor="library-filter-from" className={labelClass}>From</label>
        <input
          id="library-filter-from"
          type="date"
          value={draft.startDate}
          max={draft.endDate || undefined}
          onChange={(e) => set({ startDate: e.target.value })}
          className={fieldClass}
          style={{ colorScheme: "dark" }}
        />
      </div>
      <div className="flex flex-col">
        <label htmlFor="library-filter-to" className={labelClass}>To</label>
        <input
          id="library-filter-to"
          type="date"
          value={draft.endDate}
          min={draft.startDate || undefined}
          onChange={(e) => set({ endDate: e.target.value })}
          className={fieldClass}
          style={{ colorScheme: "dark" }}
        />
      </div>

      {/* Min tracks (playlists/favorites only — a track isn't a collection) */}
      {!isTracks && (
        <div className="flex flex-col">
          <label htmlFor="library-filter-tracks" className={labelClass}>Tracks</label>
          <select
            id="library-filter-tracks"
            value={draft.numTracks ?? ""}
            onChange={(e) => set({ numTracks: e.target.value ? Number(e.target.value) : null })}
            className={`${fieldClass} cursor-pointer`}
            style={{ colorScheme: "dark" }}
          >
            {NUM_TRACKS_OPTIONS.map((o) => (
              <option key={o.label} value={o.value ?? ""}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-[var(--px-8)] ml-auto">
        <button
          type="button"
          onClick={() => onApply(draft)}
          disabled={applyDisabled}
          className={`${btnBase} border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]`}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          className={`${btnBase} border-white/20 hover:border-white/50 text-white/80`}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${btnBase} border-white/20 hover:border-white/50 text-white/80`}
          aria-label="Refresh"
        >
          <svg
            className={`w-[var(--px-14)] h-[var(--px-14)] ${loading ? "animate-spin" : ""}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          Refresh
        </button>
      </div>
    </div>
  );
};

export default LibraryFilters;
