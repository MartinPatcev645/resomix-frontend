# Product Overview Scouting Plan (initial six needs)

Status: Draft — awaiting approval (Gate 4). No candidates shortlisted yet (per policy: live shortlisting only via official MCP/CLI or authorised browser access, after gates). No code installed.
Repository snapshot: `george-updates` at `2e00707`
Last reviewed: 2026-07-22

Common constraints for all needs — prohibited visuals: gradients, glass, large rounded cards, glow-by-default, illustration, bento grids, continuous animation; allowed dependencies: **none** without explicit approval; performance: static-first, transform/opacity only, reduced-motion parity; acceptance baseline: IMPLEMENTATION_RULES §32 + both themes + keyboard + 393/1280/1920.

## 1. Mega-menu interaction mechanics — **Research justified · HIGH priority**

Repo state: current `Navbar` renders three fixed `LinkButton`s; no disclosure system exists; the approved IA needs 5 dropdown groups (WEBSITE_ARCHITECTURE §11–17). This is exactly the hard-mechanics category (focus trap, keyboard, positioning, outside-click, escape). Search: `accessible mega menu React Tailwind keyboard`, `navigation menu dropdown focus management React`. Acceptance: full keyboard operability, Esc/outside-close, no positioning libraries without approval, mechanics only — visual identity from Resomix nav vocabulary. **Caveat:** shared-`Navbar` scope; implementation runs through the nav-redesign task with consumer audit, not the standard page flow.

## 2. Responsive technical tabs — **Research justified · MEDIUM priority**

Repo state: no tabs primitive anywhere (`packages/ui` has none). Needed for measured/predicted views, request/response switching, platform-surface switching. Search: `technical tabs React responsive`, `accessible tabs component React Tailwind`. Acceptance: roving-tab-index or listbox semantics, arrow-key support, mobile fallback (stack or select), zero deps preferred. Likely Stage 2 later (Track Intelligence + Developers).

## 3. API code block with copy action — **Research justified · MEDIUM priority**

Repo state: partners page has a curl block + "Copy Curl" button (production) but the local checkout's pattern is basic; no reusable code-block component with copy affordance/overflow handling exists in `packages/ui`. Search: `API code block copy button React`, `code snippet copy clipboard React Tailwind`. Acceptance: `<pre>/<code>` semantics, visible copy feedback (not colour-only), horizontal overflow on mobile, no syntax-highlight dependency without approval (static highlighting or none). Content = the real verified sandbox call only.

## 4. Audience-routing interaction — **Existing/custom sufficient · LOW priority · research NOT justified**

The approved pattern is a dotted index list of `[audience] — outcome — →` rows (VISUAL_UPGRADE_SYSTEM §16) — plain links + hover/focus styling already achievable with `LinkButton` conventions and CSS. External research adds nothing but drift risk. Build custom.

## 5. FAQ accordion — **Borderline · LOW priority · default: custom**

Repo state: no accordion in `packages/ui`, but the need is served by native `<details>/<summary>` + dotted styling with full a11y for near-zero effort. Research only if the approved FAQ design later needs animated height/exclusive-open behaviour: `FAQ accordion accessible React`. Until then: custom native implementation.

## 6. Partner/self-serve CTA split — **Existing/custom sufficient · research NOT justified**

The final CTA split (two labelled columns, divider, one pill each) is a layout, not a mechanic — existing pills + dotted divider cover it; already demonstrated in the design-lab prototypes. Build custom.

## Expected outcome

Only **2–3 needs (mega-menu, tabs, code block)** genuinely benefit from 21st.dev; the rest use existing or custom Resomix code. The Product Overview page must never depend on six external components.

## Change history

- 2026-07-22 — Initial plan. Author: Claude.
