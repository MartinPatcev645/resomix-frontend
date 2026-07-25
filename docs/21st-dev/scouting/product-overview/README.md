# Product Overview scouting batch

Status: Complete — awaiting the three user decisions (Gate 5)
Repository snapshot: `george-updates` at `2e00707`
Date: 2026-07-22

## Batch result

| Need | Outcome |
|---|---|
| `mega-menu/` | 1 candidate evaluated (PO-NAV-001, user-supplied) → **Possible with conditions**, as structural reference; implementation deferred to the final nav-redesign task (approved build order) |
| `technical-tabs/` | Classification 4 confirmed; **candidates pending** (listing grids are client-rendered; user shares links per agreed flow) — interim default: custom native tabs |
| `api-code-block/` | Reclassified to **2 — extend existing** (`PartnersPage` curl-copy pattern); external research stopped |

## Approved build order (user decision, endorsed)

Pages first, mega-menu last: Wave A (Product Overview → Sonic Discovery → Partner Overview) → Wave B (Track Intelligence, Catalogue Intelligence, Developers, Pilot, Trust) → Wave C (solutions + Integrations) → **then** the Navbar redesign with the mega-menu, once all pages exist (no dead links, single highest-risk change isolated at the end). Until then, new pages remain reachable via existing nav links, the footer matrix, and direct routes.

## Per-page working flow (agreed with refinements)

1. User picks the next page; optionally shares any 21st.dev links they like for its interactive parts.
2. Claude runs the reuse audit first (most sections are custom Resomix by design — component research applies only to genuine interaction mechanics).
3. Claude evaluates shared links (full evaluation + SOURCE_REGISTER row; licence check).
4. Claude designs the page against the design system (section-by-section spec incl. Void Field mode, motifs, truth labels, tokens) and, where a pattern is approved, writes the adaptation spec.
5. User approves the page design + any component decisions.
6. Claude generates the surgical Cursor task (one page, exact file scope, validation commands).
7. Review pass on the Cursor diff before the next page starts.

## Access note

Official component pages render fully for evaluation (metadata, dependencies, source project, dates); listing/search grids are client-rendered and were not scraped. No component was installed; no code was copied; no preview media was stored.

## Change history

- 2026-07-22 — Initial batch. Author: Claude.
