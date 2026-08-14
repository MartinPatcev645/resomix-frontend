/**
 * The search field's decision rules, as pure functions.
 *
 * Separated from `WorkspaceSearchField` so they can be exercised without rendering. Every one of
 * these was previously an inline expression or an `if` inside a handler, where the only way to
 * check it was to open the app and click — which is how "changing the search mode closes the
 * dropdown" survived as long as it did.
 *
 * Dependency-free (no React, no DOM) so it stays that way.
 */

/** What the matches panel should draw, given the current request state. */
export type PanelBody = "searching" | "empty" | "results";

/** What a keypress should do. `none` means the field's other handlers deal with it. */
export type EscapeAction = "close-panel" | "clear-field" | "none";

/**
 * Is the matches panel showing?
 *
 * `isOpen` is held explicitly and is **not** derived from `results.length`. Deriving it is what
 * made the panel flicker: a request in flight has no results yet, so a panel whose existence
 * depended on the array vanished mid-search and reappeared when the response landed.
 *
 * Note what is absent: there is no "did the user click somewhere else" input. Clicking away does
 * not close the panel — the Search Mode select is a sibling element, so an outside-click rule
 * closed the panel every time the mode changed. That was the reported bug.
 */
export function shouldShowPanel(isOpen: boolean, query: string, demoMode: boolean): boolean {
  return !demoMode && isOpen && query.length > 0;
}

/**
 * Is the clear (×) button showing?
 *
 * Only when there is something to clear — a permanent × on an empty field is a control that does
 * nothing, and it eats the padding the placeholder needs.
 */
export function shouldShowClear(query: string, demoMode: boolean): boolean {
  return !demoMode && query.length > 0;
}

/**
 * What goes inside the panel.
 *
 * `isLoading` outranks the results, which is the whole point: during a mode change the previous
 * results are still in state and the panel says "Searching…" over them, rather than emptying and
 * collapsing.
 */
export function panelBody(isLoading: boolean, resultCount: number): PanelBody {
  if (isLoading) return "searching";
  return resultCount === 0 ? "empty" : "results";
}

/**
 * What Escape does.
 *
 * Two jobs, because the panel no longer closes on an outside click: with the panel open Escape
 * dismisses it, and with the panel already closed Escape clears the field. Without the first,
 * a keyboard user who opened the panel would have no way to dismiss it at all.
 */
export function escapeAction(isPanelShowing: boolean, query: string): EscapeAction {
  if (isPanelShowing) return "close-panel";
  return query.length > 0 ? "clear-field" : "none";
}

/**
 * Should a mode change close the panel?
 *
 * Always false, and stated as a function so it can be asserted rather than assumed. Changing the
 * mode re-runs the search with the same query; the user's intent to see matches has not changed,
 * so neither should the panel.
 */
export function modeChangeClosesPanel(): boolean {
  return false;
}
