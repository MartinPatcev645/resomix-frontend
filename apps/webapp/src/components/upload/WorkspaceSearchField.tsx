import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SearchResult } from "@resomix/hooks";
import { useWorkspaceSearch } from "@/hooks/useWorkspaceSearch.ts";

import { WORKSPACE_FIELD_CLASS, WORKSPACE_FOCUS_VISIBLE } from "@/sections/desktop/Workspace/workspacePanelStyles.ts";
import { escapeAction, panelBody, shouldShowClear, shouldShowPanel } from "./searchFieldState.ts";

const OVERLAY_CLASS =
  "absolute left-0 right-0 top-full z-40 max-h-[22rem] overflow-y-auto overscroll-contain border border-[var(--rx-color-border-default)] border-t-0 bg-[var(--rx-color-surface)] shadow-[0_8px_24px_rgba(0,0,0,.45)]";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const { query, results, isLoading, handleQueryChange, clearQuery } = useWorkspaceSearch();

  /**
   * Whether the matches panel is open — held explicitly, never inferred from `results.length`.
   *
   * Inferring it is what made the panel flicker: a request in flight has no results yet, so a
   * panel whose existence depended on the array vanished mid-search and came back. `isOpen` says
   * "the user wants to see matches"; `isLoading` and `results` say what to draw inside.
   */
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // An empty input has nothing to show, which is also the ONLY thing that closes the panel other
  // than Escape or picking a result — see the outside-click note below.
  const showDropdown = shouldShowPanel(isOpen, query, demoMode);

  // Only when there is something to clear. A permanently-visible × on an empty field is a control
  // that does nothing, and it eats the padding the placeholder needs.
  const showClear = shouldShowClear(query, demoMode);

  const selectResult = useCallback(
    (item: SearchResult) => {
      setIsOpen(false);
      setActiveIndex(-1);
      onTrackSelect?.(item);
    },
    [onTrackSelect],
  );

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  /** Clear (×): empty the query, close the panel, and put the caret back where the user left it. */
  const handleClear = useCallback(() => {
    clearQuery();
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [clearQuery]);

  // NO outside-click close, deliberately.
  //
  // A `pointerdown` listener on the document used to close the panel whenever the click landed
  // outside this component — and the Search Mode select is a *sibling*, not a child. So changing
  // the mode closed the matches panel, which is the behaviour that was reported. (The panel was
  // not emptying itself: `performSearch` leaves the old results in place while the new request is
  // in flight, and the panel renders "Searching…" over them.)
  //
  // Escape and the clear button are the exits. Both are wired below; without them the panel would
  // be a trap, which is the price of departing from the usual dropdown convention.

  useEffect(() => {
    if (!showDropdown || activeIndex < 0) return;
    document.getElementById(`${listboxId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, showDropdown, listboxId]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (demoMode) return;
    // Escape works whether or not the panel is showing: with it open it closes the panel, and with
    // it already closed it clears the field — the standard search-input behaviour, and the reason
    // a keyboard user is never stuck with a panel they cannot dismiss.
    if (e.key === "Escape") {
      const action = escapeAction(showDropdown, query);
      if (action === "none") return;
      e.preventDefault();
      if (action === "close-panel") closeDropdown();
      else handleClear();
      return;
    }
    if (!showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp") && query.length > 0) {
      setIsOpen(true);
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
    }
  };

  const activeDescendant =
    showDropdown && activeIndex >= 0 && results[activeIndex]
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  return (
    <div ref={rootRef} className="relative min-w-0 w-full flex-1">
      <div
        className={[
          `flex ${WORKSPACE_FIELD_CLASS} focus-within:shadow-[var(--rx-ring)]`,
          showDropdown ? "rounded-b-none" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
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
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (demoMode) {
              onDemoFocus?.();
              return;
            }
            if (query.length > 0) setIsOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search by artist or title…"
          aria-label="Search the Resomix index by artist or title"
          // `pr-0` when there is no clear button, so the placeholder is not oddly inset; when there
          // is one the padding reserves its whole 44px tap target, or long queries would run
          // underneath the glyph and become unreadable exactly when you want to edit them.
          className={[
            "min-w-0 flex-1 border-0 bg-transparent pl-[var(--px-18)]",
            showClear ? "pr-0" : "pr-[var(--px-18)]",
            "font-fira text-[length:var(--px-15)] tracking-[0.02em] text-[var(--rx-color-text-primary)]",
            "placeholder:font-fira placeholder:text-[var(--rx-color-text-muted)] focus:outline-none",
          ].join(" ")}
        />
        {showClear && (
          <button
            type="button"
            // Full 44×44 — the WCAG 2.5.5 target size, and the field is exactly 44px tall so it
            // fits without changing the row. The glyph inside stays small; the hit area is what
            // needs the size, not the ×.
            className={[
              WORKSPACE_FOCUS_VISIBLE,
              "flex h-[var(--px-44)] w-[var(--px-44)] shrink-0 items-center justify-center",
              "font-fira text-[length:var(--px-16)] leading-none",
              "text-[var(--rx-color-text-muted)]",
              "transition-colors duration-[var(--rx-duration-base)]",
              "hover:text-[var(--rx-color-text-primary)]",
            ].join(" ")}
            // Native tooltip on hover; the aria-label is what a screen reader announces, since the
            // × on its own reads as punctuation.
            title="Clear search"
            aria-label="Clear search"
            // The input would otherwise blur on mousedown, and `handleClear` refocuses it a moment
            // later — a visible flicker of the focus ring for a control that never actually lost
            // focus in the user's mind.
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          >
            <span aria-hidden="true">×</span>
          </button>
        )}
      </div>
      {showDropdown && (
        <div id={listboxId} className={OVERLAY_CLASS} role="listbox" aria-label="Matches">
          {panelBody(isLoading, results.length) === "searching" ? (
            <p className="px-[var(--px-14)] py-[var(--px-10)] font-fira text-[length:var(--px-13)] opacity-60">
              Searching…
            </p>
          ) : panelBody(isLoading, results.length) === "empty" ? (
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
                  `${WORKSPACE_FOCUS_VISIBLE} search-dropdown-item flex w-full items-center justify-between px-[var(--px-14)] py-[var(--px-10)] text-left text-[length:var(--px-13)] text-[var(--rx-color-text-primary)] hover:bg-[rgba(255,255,255,0.035)]`,
                  compact ? "gap-[var(--px-12)]" : "gap-[var(--px-16)]",
                  activeIndex === index ? "bg-[rgba(255,255,255,0.04)]" : "text-[var(--rx-color-text-secondary)] hover:text-[var(--rx-color-text-primary)]",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectResult(item)}
              >
                <span className={compact ? "min-w-0 truncate" : undefined}>
                  {item.title}
                  {item.artist ? (
                    <>
                      {" · "}
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
