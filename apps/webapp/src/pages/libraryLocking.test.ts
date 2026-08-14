/**
 * Library row locking — the client half of the cap
 * ================================================
 *
 * WHAT THE CAP ACTUALLY DOES
 *
 * It does not remove playlists from the list. Every playlist the user owns is returned; the ones
 * beyond the cap arrive with no `id`, `uuid` or `seed_track_uuid`. **The missing identifier is the
 * enforcement** — a client cannot construct a route to something it has no id for. Greying the row
 * explains that to the user; it does not cause it.
 *
 * Which is why every check here derives locking from the ABSENT UUID rather than from a display
 * flag. A UI that gated on `isVisible` while the server gated on the identifier could drift; one
 * that gates on the identifier cannot.
 *
 * WHAT THIS FILE GUARDS
 *
 * The two ways this leaks, both of which look fine in review:
 *
 *   1. An `href` left in place on a locked row. The onClick guard does not run on a right-click or
 *      a ⌘-click — the browser just opens `?id=`, and the user gets a broken page instead of an
 *      explanation.
 *   2. An action wired directly instead of through `guardLocked`, so a locked row can still be
 *      renamed, favourited, made public or deleted.
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

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(join(HERE, "LibraryPage.tsx"), "utf8");
const HOOK = readFileSync(join(HERE, "../../../../packages/hooks/src/Library/useLibrary.ts"), "utf8");

/**
 * The PLAYLIST row body only.
 *
 * Ends at the tracks block, not at the pagination controls: the two tabs render in the same JSX
 * tree, and a slice that ran to the end of both counted the Uploads tab's handlers as unguarded
 * playlist actions. The first version of this file did exactly that and reported eight phantom
 * leaks.
 */
const ROW = PAGE.split("const locked = !playlist.uuid;")[1].split("tracks.length === 0")[0];

/** Handlers that are not row actions: wrappers whose only job is to stop the click bubbling. */
const isPropagationStopper = (handler: string) => /onClick=\{e => e\.stopPropagation\(\)\}/.test(handler);

// --------------------------------------------------------------------------- //
// Where "locked" comes from
// --------------------------------------------------------------------------- //

test("locking is derived from the absent uuid, not from a display flag", () => {
  // `is_visible` is informational. The uuid is what the server actually withheld, so deriving from
  // it means the UI cannot claim a row is openable when the API has made it unopenable.
  assert.ok(PAGE.includes("const locked = !playlist.uuid;"));
});

test("a locked playlist is mapped with a null uuid, not an empty string", () => {
  // An empty string is falsy but still interpolates: `?id=` looks like a link and navigates to a
  // broken page. `null` makes the absence explicit and forces the type system to surface it.
  assert.ok(/uuid: isVisible \? \(p\.uuid \|\| p\.id\) : null/.test(HOOK));
});

test("a locked row still gets a stable React key", () => {
  // With no uuid there is no natural key. Positional, and prefixed so it can never be mistaken for
  // a uuid and handed to a route.
  assert.ok(/id: isVisible \? String\(p\.id \|\| p\.uuid\) : `locked-\$\{index\}`/.test(HOOK));
  assert.ok(PAGE.includes("key={playlist.id}"), "the row must key off `id`, not the nullable uuid");
});

test("an older backend that omits the flag locks nothing", () => {
  // Fail open, matching the backend's own rule. A response without `is_visible` must not grey out
  // somebody's entire Library.
  assert.ok(HOOK.includes("const isVisible = p.is_visible !== false;"));
});

// --------------------------------------------------------------------------- //
// The links
// --------------------------------------------------------------------------- //

test("no locked row carries an href", () => {
  // The leak that the onClick guard cannot catch: right-click → "Open in new tab" bypasses every
  // handler and goes straight to `/sonic-discovery?id=`.
  const hrefs = ROW.match(/href=\{[^}]*\}/g) ?? [];

  assert.ok(hrefs.length >= 2, `expected the cover and title links, found ${hrefs.length}`);
  for (const href of hrefs) {
    assert.ok(
      href.includes("locked ? undefined"),
      `an href is not conditional on locked: ${href}`,
    );
  }
});

// --------------------------------------------------------------------------- //
// The actions
// --------------------------------------------------------------------------- //

test("every interactive control on the row goes through the lock guard", () => {
  // Counted rather than spot-checked: a new action added later without the guard is exactly the
  // regression this catches, and it would not show up in any single assertion.
  //
  // Two exclusions, both deliberate. Bare `stopPropagation` wrappers are not actions. And the
  // dropdown's own items sit behind `!locked &&`, so they cannot render on a locked row at all —
  // that is asserted separately below rather than by wrapping each one.
  const menuless = ROW.split("{!locked && activeMenuId === uuid &&")[0];
  const handlers = (menuless.match(/onClick=\{[^\n]*/g) ?? []).filter((h) => !isPropagationStopper(h));
  const guarded = handlers.filter((h) => h.includes("guardLocked("));

  assert.deepEqual(
    handlers.filter((h) => !h.includes("guardLocked(")),
    [],
    "the listed row action(s) bypass guardLocked",
  );
  assert.ok(guarded.length >= 6, `expected the full action cluster, found ${guarded.length}`);
});

test("the dropdown menu cannot render on a locked row", () => {
  // The kebab that opens it is guarded, so this is belt and braces — but it turns "unreachable
  // because activeMenuId can never be the empty string" from an argument into a structural fact.
  // Every item inside (open in new tab, share, export, embed, delete) is covered by this one line.
  assert.ok(ROW.includes("{!locked && activeMenuId === uuid &&"));
});

test("the guard blocks the default action, not just the handler", () => {
  // Without preventDefault the anchor still navigates after the notice opens — the user gets both
  // the modal and the broken page.
  const guard = PAGE.split("const guardLocked =")[1].split("};")[0];

  assert.ok(guard.includes("e.preventDefault()"));
  assert.ok(guard.includes("e.stopPropagation()"));
  assert.ok(guard.includes("showLockedNotice()"));
  assert.ok(/return;/.test(guard), "the guard must not fall through to the real action");
});

test("favouriting cannot be used to unlock a playlist", () => {
  // DECIDED: no favourite exemption. Favouriting is a flag the user controls, so an exemption
  // would let anyone opt out of the cap by hearting everything.
  const heart = ROW.split("Favorite heart")[1].split("</Tooltip>")[0];

  assert.ok(heart.includes("guardLocked("), "the favourite toggle is not gated");
});

// --------------------------------------------------------------------------- //
// What the user is told
// --------------------------------------------------------------------------- //

test("the notice names the reason rather than just asking for money", () => {
  // A user looking at a row they made, still plainly there, needs to know what changed about it.
  // "Upgrade required" alone reads like the playlist was taken away.
  const notice = PAGE.split("const showLockedNotice =")[1].split("};")[0];

  assert.ok(/most recent 5/.test(notice), "the notice does not say why this row is locked");
  assert.ok(
    /nothing has been deleted/i.test(notice),
    "the notice does not reassure that the playlist still exists",
  );
});

test("the row is dimmed but not hidden", () => {
  // The point of listing locked rows at all: a free user who previously saw five playlists must be
  // able to see that the rest are still there.
  assert.ok(/locked\s*$/m.test(ROW) || ROW.includes("opacity-55"), "locked rows are not dimmed");
  assert.ok(!/locked \?\s*null/.test(ROW), "locked rows are being hidden rather than dimmed");
});

test("a locked row does not request a cover it cannot address", () => {
  assert.ok(ROW.includes("hasCustomCover={!locked && playlist.hasCustomCover}"));
});
