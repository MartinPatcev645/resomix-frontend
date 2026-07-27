import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SearchResult } from "@resomix/hooks";
import { useWorkspaceSearch } from "@/hooks/useWorkspaceSearch.ts";

const OVERLAY_CLASS =
  "absolute left-0 right-0 top-full z-40 max-h-[22rem] overflow-y-auto overscroll-contain border border-[rgba(255,255,255,.14)] border-t-0 bg-[#0d0d0d] shadow-[0_8px_24px_rgba(0,0,0,.45)]";

interface WorkspaceSearchFieldProps {
  onTrackSelect?: (track: SearchResult) => void;
  /** When true, blocks query input (demo mode). */
  demoMode?: boolean;
  onDemoFocus?: () => void;
  onDemoChange?: () => void;
  compact?: boolean;
}

export const WorkspaceSearchField: React.FC<WorkspaceSearchFieldProps> = ({
  onTrackSelect,
  demoMode = false,
  onDemoFocus,
  onDemoChange,
  compact = false,
}) => {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { query, results, isLoading, handleQueryChange } = useWorkspaceSearch();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const showDropdown = !demoMode && open && query.length > 0;

  const selectResult = useCallback(
    (item: SearchResult) => {
      setOpen(false);
      setActiveIndex(-1);
      onTrackSelect?.(item);
    },
    [onTrackSelect],
  );

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const onDocPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [showDropdown, closeDropdown]);

  useEffect(() => {
    if (!showDropdown || activeIndex < 0) return;
    document.getElementById(`${listboxId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showDropdown, listboxId]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (demoMode) return;
    if (!showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp") && query.length > 0) {
      setOpen(true);
      setActiveIndex(results.length ? 0 : -1);
      e.preventDefault();
      return;
    }
    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown();
    }
  };

  const activeDescendant =
    showDropdown && activeIndex >= 0 && results[activeIndex]
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  return (
    <div ref={rootRef} className="relative min-w-[min(100%,20rem)] flex-1">
      <div
        className={[
          "flex w-full border border-dotted border-slate-400 bg-transparent",
          showDropdown ? "border-b-0" : "",
        ].join(" ")}
      >
        <input
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          value={demoMode ? "" : query}
          onChange={(e) => {
            if (demoMode) {
              onDemoChange?.();
              return;
            }
            handleQueryChange(e);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (demoMode) {
              onDemoFocus?.();
              return;
            }
            if (query.length > 0) setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search by artist or title…"
          aria-label="Search the Resomix index by artist or title"
          className="min-w-0 flex-1 border-0 bg-transparent px-[var(--px-14)] py-[var(--px-12)] font-fira text-[length:var(--px-13)] text-[var(--color-primary)] placeholder:font-fira placeholder:opacity-50 focus:outline-none"
        />
      </div>
      {showDropdown && (
        <div id={listboxId} className={OVERLAY_CLASS} role="listbox" aria-label="Matches">
          {isLoading ? (
            <p className="px-[var(--px-14)] py-[var(--px-10)] font-fira text-[length:var(--px-13)] opacity-60">
              Searching...
            </p>
          ) : results.length === 0 ? (
            <p className="px-[var(--px-14)] py-[var(--px-10)] font-fira text-[length:var(--px-13)] opacity-60">
              No results found.
            </p>
          ) : (
            results.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                id={`${listboxId}-opt-${index}`}
                aria-selected={activeIndex === index}
                className={[
                  "search-dropdown-item flex w-full items-center justify-between px-[var(--px-14)] py-[var(--px-10)] text-left text-[length:var(--px-13)] text-[var(--color-primary)] hover:bg-[rgba(255,255,255,.05)]",
                  compact ? "gap-[var(--px-12)]" : "gap-[var(--px-16)]",
                  activeIndex === index ? "bg-[rgba(255,255,255,.05)] opacity-100" : "opacity-75 hover:opacity-100",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(item)}
              >
                <span className={compact ? "min-w-0 truncate" : undefined}>
                  {item.title}
                  {item.artist ? (
                    <>
                      {" — "}
                      <span className="opacity-80">{item.artist}</span>
                    </>
                  ) : null}
                </span>
                {item.duration ? (
                  <span className="shrink-0 font-fira text-[length:var(--px-11)] opacity-50">
                    {item.duration}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
