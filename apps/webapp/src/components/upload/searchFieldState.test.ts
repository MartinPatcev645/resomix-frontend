/**
 * Search field — panel and clear-button rules
 * ===========================================
 *
 * THE REPORTED BUG
 *
 * Changing the Search Mode closed the matches dropdown.
 *
 * The cause is worth stating precisely, because the plan doc had it wrong and the wrong version is
 * more plausible than the right one. It was **not** that the results array emptied while the new
 * request was in flight — `performSearch` leaves the previous results in state and the panel
 * renders "Searching…" over them. It was a `pointerdown` listener on the document that closed the
 * panel whenever a click landed outside the field, and the Search Mode `<select>` is a *sibling*
 * of the field, not a child. Clicking it was, to that listener, clicking away.
 *
 * So the fix for "mode change closes the panel" is the removal of the outside-click rule, which is
 * also task 25. The two are the same change, and `test_the_outside_click_listener_stays_removed`
 * is what stops someone reinstating it as an obvious-looking improvement.
 *
 * HOW TO RUN
 *
 *     pnpm --filter webapp test:pure
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import {
  escapeAction,
  modeChangeClosesPanel,
  panelBody,
  shouldShowClear,
  shouldShowPanel,
} from "./searchFieldState.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIELD_SOURCE = readFileSync(join(HERE, "WorkspaceSearchField.tsx"), "utf8");

// --------------------------------------------------------------------------- //
// The panel stays open (tasks 22–24)
// --------------------------------------------------------------------------- //

test("a mode change does not close the panel", () => {
  // Nothing the mode change touches is an input to `shouldShowPanel`. Same open flag, same query,
  // same answer — which is the property, stated the only way that cannot rot.
  assert.equal(shouldShowPanel(true, "aphex", false), true);
  assert.equal(modeChangeClosesPanel(), false);
});

test("the panel survives a request that has not answered yet", () => {
  // The failure mode being prevented: an in-flight search has no results, so a panel derived from
  // `results.length` would vanish here and reappear when the response landed.
  assert.equal(shouldShowPanel(true, "aphex", false), true);
  assert.equal(panelBody(true, 0), "searching");
});

test("mid-search it says Searching, not No results", () => {
  // Both are "zero results" as far as the array is concerned. Only one of them is true.
  assert.equal(panelBody(true, 0), "searching");
  assert.equal(panelBody(false, 0), "empty");
});

test("previous results are still there while the new mode loads", () => {
  // `isLoading` outranks a non-empty array too — otherwise a mode change would show the OLD mode's
  // matches with no indication they are stale.
  assert.equal(panelBody(true, 12), "searching");
  assert.equal(panelBody(false, 12), "results");
});

test("clearing the input is what closes the panel", () => {
  assert.equal(shouldShowPanel(true, "aphex", false), true);
  assert.equal(shouldShowPanel(true, "", false), false);
});

test("demo mode shows no panel at all", () => {
  assert.equal(shouldShowPanel(true, "aphex", true), false);
});

// --------------------------------------------------------------------------- //
// Escape — the exit that makes the rest safe (task 26)
// --------------------------------------------------------------------------- //

test("Escape closes an open panel", () => {
  assert.equal(escapeAction(true, "aphex"), "close-panel");
});

test("Escape clears the field once the panel is already closed", () => {
  assert.equal(escapeAction(false, "aphex"), "clear-field");
});

test("Escape on an empty field is left to the browser", () => {
  // Returning "none" rather than swallowing the key: preventDefault on an empty field would break
  // Escape for anything containing this component, e.g. dismissing a modal.
  assert.equal(escapeAction(false, ""), "none");
});

test("a keyboard user is never stuck with a panel they cannot dismiss", () => {
  // The panel no longer closes on an outside click, so this is the ONLY keyboard exit. If it ever
  // returned "none" while the panel was showing, the panel would be a trap.
  assert.notEqual(escapeAction(true, "anything"), "none");
});

// --------------------------------------------------------------------------- //
// The clear button (tasks 27–33)
// --------------------------------------------------------------------------- //

test("the clear button appears only when there is something to clear", () => {
  assert.equal(shouldShowClear("", false), false);
  assert.equal(shouldShowClear("a", false), true);
});

test("no clear button in demo mode — the field is not editable there", () => {
  assert.equal(shouldShowClear("aphex", true), false);
});

// --------------------------------------------------------------------------- //
// Rules that only exist in the component — asserted against its source
// --------------------------------------------------------------------------- //

test("the outside-click listener stays removed", () => {
  // The regression guard. Re-adding a document pointerdown/mousedown close looks like a fix for
  // "the dropdown won't go away" and silently restores the reported bug, because the Search Mode
  // select is outside this component's root.
  assert.ok(
    !/addEventListener\(\s*["'](pointerdown|mousedown|click)["']/.test(FIELD_SOURCE),
    "a document-level click listener is back — this is what closed the panel on a mode change",
  );
});

test("the clear button carries both a tooltip and an accessible name", () => {
  // The × alone reads as punctuation to a screen reader, and `title` is the hover affordance.
  // They are separate attributes and it is easy to add one and think it covers the other.
  //
  // Matched with a leading-whitespace boundary, not `includes`. A plain substring check passes on
  // `data-title="Clear search"` — which renders no tooltip at all — and this test was written with
  // one until a deliberate sabotage run walked straight through it.
  assert.ok(/\stitle="Clear search"/.test(FIELD_SOURCE), "no native tooltip on the clear button");
  assert.ok(/\saria-label="Clear search"/.test(FIELD_SOURCE), "no accessible name on the clear button");
});

test("the clear button meets the 44x44 touch target", () => {
  // WCAG 2.5.5. The glyph is 16px; the hit area is what has to be 44, and the field is exactly
  // 44 tall so it costs no layout.
  assert.ok(/h-\[var\(--px-44\)\]\s+w-\[var\(--px-44\)\]/.test(FIELD_SOURCE));
});

test("clearing returns focus to the input", () => {
  // Otherwise focus lands on a button that has just removed itself from the DOM, and the user is
  // dropped to the top of the tab order mid-search.
  const handler = FIELD_SOURCE.split("const handleClear")[1].split("}, [clearQuery])")[0];
  assert.ok(handler.includes("inputRef.current?.focus()"));
  assert.ok(handler.includes("setIsOpen(false)"));
});

test("the clear button does not let the input blur first", () => {
  // Without preventDefault on mousedown the input blurs, then `handleClear` refocuses it — a
  // visible flicker of the focus ring on a control the user never left.
  assert.ok(/onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/.test(FIELD_SOURCE));
});

test("the input reserves room for the button so text cannot run underneath", () => {
  assert.ok(/showClear \? "pr-0" : "pr-\[var\(--px-18\)\]"/.test(FIELD_SOURCE));
});

test("the panel is never driven by results.length", () => {
  // The shape the fix exists to prevent. `isOpen` says whether the user wants matches; the results
  // array says what to draw inside. Conflating them is the flicker.
  assert.ok(
    !/showDropdown\s*=.*results\.length/.test(FIELD_SOURCE),
    "panel visibility is being derived from the results array again",
  );
});
