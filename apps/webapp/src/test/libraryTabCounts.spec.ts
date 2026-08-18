/**
 * Library tabs: on a phone, only the ACTIVE tab shows its count.
 *
 * Three tab labels each carrying a count — "Uploads (25) · Playlists (14) · Liked (14)", and the
 * Playlists one can read "5 of 18" — overflowed a phone's width and pushed "Liked" off the right
 * edge. The labels are `whitespace-nowrap`, so nothing could wrap and the row just ran off-screen.
 *
 * The fix hides the count on inactive tabs below `md` only. Two properties matter, and the second
 * is the one most likely to be broken by a later "tidy-up":
 *
 *   1. an inactive tab's count is hidden on mobile;
 *   2. **desktop still shows all three** — hiding them everywhere would quietly delete information
 *      from a layout that has room for it.
 *
 * Source inspection rather than a render: `LibraryPage` pulls in the whole library stack (stores,
 * entitlements, artifact polling, router), and mocking all of it to assert one class would test the
 * mocks. `pages/libraryLocking.test.ts` reads its source for the same reason.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "../pages/LibraryPage.tsx"), "utf8");

/** The three tabs, and the `activeTab` value each one is the active tab for. */
const TABS = [
  { label: "Uploads", key: "tracks" },
  { label: "Playlists", key: "playlists" },
  { label: "Liked", key: "liked" },
] as const;

describe("library tab counts on mobile", () => {
  it("hides an inactive count on mobile but keeps it from md up", () => {
    const decl = SRC.match(/const INACTIVE_TAB_COUNT\s*=\s*"([^"]+)"/);
    expect(decl, "INACTIVE_TAB_COUNT should exist").not.toBeNull();

    const classes = decl![1].split(/\s+/);
    // `hidden` alone would remove the count at EVERY width — the regression this guards.
    expect(classes).toContain("hidden");
    expect(classes.some((c) => /^md:(inline|block|inline-block)$/.test(c))).toBe(true);
  });

  it.each(TABS)("shows $label's count only when $label is the active tab", ({ key }) => {
    // Each count span is gated on its OWN tab being active. A copy-paste slip here (two tabs
    // testing the same key) would leave one tab permanently showing or hiding its count.
    const gate = new RegExp(
      `activeTab === "${key}" \\? undefined : INACTIVE_TAB_COUNT`,
    );
    expect(SRC).toMatch(gate);
  });

  it("gates every tab count — none is rendered unconditionally", () => {
    const gates = SRC.match(/activeTab === "\w+" \? undefined : INACTIVE_TAB_COUNT/g) ?? [];
    expect(gates).toHaveLength(TABS.length);
    // All three gates must be distinct, i.e. one per tab.
    expect(new Set(gates).size).toBe(TABS.length);
  });

  it("keeps the tab labels themselves always visible", () => {
    // Only the COUNT is responsive. If a label ever ends up inside the hidden span, the tab becomes
    // an unlabelled underline on mobile.
    for (const { label } of TABS) {
      const labelThenSpan = new RegExp(
        `${label}\\s*\\n\\s*<span className=\\{activeTab ===`,
      );
      expect(SRC, `${label} must sit outside the count span`).toMatch(labelThenSpan);
    }
  });
});
