import React, { useEffect, useState } from "react";
import type { LibraryFilters as LibraryFiltersValue } from "@resomix/stores";
import { PAGE_BTN_PRIMARY, PAGE_BTN_SECONDARY, PAGE_FIELD, PAGE_FIELD_LABEL } from "@resomix/ui";
import type { LibraryTab } from "@resomix/stores";

// Imported, not redeclared. A local copy of this type is what let the Liked tab exist in
// the store and the URL while this component still believed there were only two.

interface LibraryFiltersProps {
  activeTab: LibraryTab;
  /** The filters currently applied for the active tab — seeds (and re-seeds) the draft. */
  applied: LibraryFiltersValue;
  loading?: boolean;
  onApply: (filters: LibraryFiltersValue) => void;
  onClear: () => void;
}

// "At least N tracks" options for the playlists tab (backend treats num_tracks as a minimum).
const NUM_TRACKS_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Any", value: null },
  { label: "10+", value: 10 },
  { label: "20+", value: 20 },
  { label: "50+", value: 50 },
  { label: "100+", value: 100 },
];

const fieldClass = `${PAGE_FIELD} py-[var(--px-6)] font-fira text-[length:var(--px-12)]`;
const labelClass = `${PAGE_FIELD_LABEL} mb-[var(--px-4)]`;

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

  // NOTE: favoritesOnly is intentionally excluded — it now lives as a standalone toggle next to
  // Filters/Refresh (applied immediately), not as part of this panel's draft/Apply/Clear.
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

      {/* Date range — From/To share one row (each grows to fill), and only stack when the screen is
          too narrow: each cell keeps a min width, so below ~2× that the inner flex wraps. On mobile
          the pair spans a full row; on desktop it sizes to its content inline with the rest. */}
      <div className="flex flex-wrap gap-[var(--px-10)] w-full md:w-auto">
        <div className="flex flex-col grow shrink basis-[var(--px-130)] min-w-[var(--px-120)]">
          <label htmlFor="library-filter-from" className={labelClass}>From</label>
          <input
            id="library-filter-from"
            type="date"
            value={draft.startDate}
            max={draft.endDate || undefined}
            onChange={(e) => set({ startDate: e.target.value })}
            className={`${fieldClass} w-full`}
            style={{ colorScheme: "dark" }}
          />
        </div>
        <div className="flex flex-col grow shrink basis-[var(--px-130)] min-w-[var(--px-120)]">
          <label htmlFor="library-filter-to" className={labelClass}>To</label>
          <input
            id="library-filter-to"
            type="date"
            value={draft.endDate}
            min={draft.startDate || undefined}
            onChange={(e) => set({ endDate: e.target.value })}
            className={`${fieldClass} w-full`}
            style={{ colorScheme: "dark" }}
          />
        </div>
      </div>

      {/* Min tracks (playlists only — a track isn't a collection) */}
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
          className={PAGE_BTN_PRIMARY}
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled}
          className={PAGE_BTN_SECONDARY}
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default LibraryFilters;
