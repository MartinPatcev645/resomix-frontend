# Resomix Web Design System

Status: Draft proposal — awaiting approval (revision 3 — visual direction reset)
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Governs the visual design of the new Resomix marketing pages (Phase 1). Does not change the webapp or admin. Subordinate to `docs/BRAND_GUIDELINES.pdf` for identity and to the real repository for implementation tokens. **The final upgraded visual direction is pending approval of the Resomix-native visual system in `docs/design-lab/` (see IMPLEMENTATION_RULES §37); no external website is a design authority.**
Primary sources: `docs/BRAND_GUIDELINES.pdf`; `apps/landing/src/index.css`; `apps/landing/src/styles/pixels.css`; `apps/landing/src/styles/fonts.css`; `packages/ui/src/index.ts`; `packages/ui/src/Layout/{SideLines,Navbar,MobileNavbar,GlobalFooter,GlobalMobileFooter}.tsx`; `packages/ui/src/Animations/StaticNoise.tsx`; `apps/landing/src/components/Layout/LandingLayout.tsx`; supplied `Resomix Web — Engineering Instructions`
Last reviewed: 2026-07-22

Language note (revision 2): public marketing copy uses **British English** ("Catalogue Intelligence"); internal/code terminology may remain "Catalog" where established. See WEBSITE_ARCHITECTURE header.

Every rule below is labeled with its source:

- **[BRAND]** — defined by the brand book (`docs/BRAND_GUIDELINES.pdf`)
- **[REPO]** — existing repository convention (verified in source)
- **[EXT]** — new recommended web extension (proposal)
- **[APPROVAL]** — requires human approval before use

---

## 1. Purpose and authority

This document translates the Resomix brand identity into an implementation-oriented design system for ~15 new marketing pages in `apps/landing`. It governs visual decisions only. Engineering conventions live in `docs/IMPLEMENTATION_RULES.md`; page structure and routes live in `docs/WEBSITE_ARCHITECTURE.md` and `docs/PAGE_BRIEFS.md`.

## 2. Source hierarchy

1. `docs/BRAND_GUIDELINES.pdf` — identity authority (logo, colors, typography roles).
2. The repository as-built — implementation authority (tokens, components, layout system).
3. This document — web interpretation where 1 and 2 are silent.
4. Items marked [APPROVAL] — decided by no source; blocked on human sign-off.

Where the brand book and the repository conflict, the conflict is recorded in §41/§43 and left for approval; nothing is silently changed.

## 3. Repository snapshot

- Branch `george-updates`, commit `2e00707` ("initial commit after downloading zip"), remote `https://github.com/Resomix/resomix-web.git`.
- Pre-existing uncommitted change: `apps/landing/src/sections/desktop/Home/HomeTwo.tsx` (1 line) — not touched by this phase.
- Described throughout as the **current local checkout**; remote freshness not verified (no fetch/pull performed, per phase rules).

## 4. Brand principles

[BRAND] The palette is "based on simplicity and innovation" (brand book p.4). The logo system is a custom technical logotype with outline, compact, and signet variants (pp.1–2). Typography is Helvetica Neue for headlines/main text, Fira Code for secondary technical text, Benzin Bold for accentuated text (p.5). Mockups (pp.10–12) show monochrome space-black scenes, sparse neon-orange illumination (glowing orb gradient), Fira Code micro-labels, and light-ring geometry — the authoritative mood reference.

[EXT] Web principle adopted from the Phase 1 direction:

> Space is the atmosphere and information model of the Resomix interface, not a literal illustration theme. The experience should feel like navigating a vast sonic-intelligence system through signal, depth, scale, data, and controlled illumination.

## 5. Existing Resomix design audit

[REPO] Verified as-built conventions the new pages must extend, not replace:

| Pattern | Evidence |
|---|---|
| Fluid rem sizing authored at 1280/393 | `apps/landing/src/index.css` (`clamp(12.8px, 1.25vw, 32px)`; mobile `clamp(10px, 4.07vw, 41.6px)`) |
| `--px-N` sizing tokens (~273 in landing) | `apps/landing/src/styles/pixels.css` |
| Dark-default theme, `.light` overrides | `apps/landing/src/index.css` `:root` / `.light` |
| Dotted borders as the structural motif | `border-dotted` in 45 files / 166 occurrences repo-wide |
| WebGL "Seagull Nebula" static-noise background mounted once per app by the layout | `packages/ui/src/Animations/StaticNoise.tsx`; `LandingLayout.tsx` |
| `SideLines` dotted page frame with `mode` semantics | `packages/ui/src/Layout/SideLines.tsx` |
| Helvetica (uppercase, light/medium) for UI; Fira Code for terminal/metadata; Benzin for display statements | `fonts.css`; `GlobalFooter.tsx`; `HomeHero.tsx`; `UploadHero.tsx` |
| Section pages composed of ordered `<Page>Hero/One/Two…` sections in `sections/{desktop,mobile}/<Page>/` | `apps/landing/src/sections/` |
| Terminal-styled footer with typed Fira Code lines and Benzin watermark | `packages/ui/src/Layout/GlobalFooter.tsx` |

## 6. Brand-book facts

[BRAND] Extracted from `docs/BRAND_GUIDELINES.pdf` (14 pages):

- **Logo variants** (pp.1–2): main logotype RESOMIX; outline logotype ("supplement, on larger formats or in a pattern"); compact logotype (RESO / MIX stacked); compact outline; signet "R"; signet outline.
- **Safe space** (p.3): protective field around the logo defined by the ® marker unit shown in the diagram; no graphic or text elements inside it.
- **Colors** (p.4): White `#FFFFFF`, Light Gray `#B9B9B9`, Neon Orange `#EE4A26`, Space Black `#101010`. Note: the Phase 1 task brief lists neon orange as `#EC4A26`; the brand book and the entire repository use `#EE4A26`. **`#EE4A26` is treated as authoritative.**
- **Typography** (p.5): Helvetica Neue — headlines and main text; Fira Code — secondary texts ("innovative technological vector"); Benzin Bold — accentuated texts ("strength and definition… highlight and add variety").
- **Backgrounds** (p.6): dark logo on light backgrounds, light logo on dark; avoid patterned or overly contrasting backgrounds behind the logo.
- **Minimum sizes** (p.7): logotype 50px (recommended) / 25px (absolute minimum width); compact logotype 50px / 25px; signet 80px / 50px. Below these, switch to a more compact variant.
- **Do / Don't** (p.8): DO respect safe space, use correct colors, use the signet frequently. DON'T stretch or compress, change colors, add special effects (e.g., drop shadows).
- **Icons** (p.9): custom technical line-icon set (waveform-in-circle, concentric resonance rings, orbital nodes, converging signal lines, arc/orbit, node starburst, stacked layers) "used within Resomix brand digital and physical products."
- **Mockups** (pp.10–12): monochrome space-black scenes; neon-orange orb glow; light rings; Fira Code micro-annotations; sample slogan "A discovery engine for DJs who feel the music."

## 7. Web interpretation of the space and sonic direction

[EXT] The atmosphere is built from what already exists, in this order of preference:

1. **Vast space-black fields + controlled negative space** — large sections on the dark background, content constrained by the existing `SideLines` frame.
2. **A layout-owned film/atmosphere layer** provides texture and depth; pages never add their own copy. The approved future implementation is the static Resomix Void Field (§45); the current `StaticNoise` WebGL is the audited legacy implementation on existing pages only.
3. **Signal and resonance geometry** — waveforms, frequency patterns, orbital/connection motifs in the style of the brand icon set (p.9) and existing composite SVGs (`apps/landing/src/assets/icons/composites/`).
4. **Technical coordinates and labels** — Fira Code micro-labels, in the style of the existing footer and webapp hero terminals (e.g., `PYXIS-1 Engine: v5.3.9`).
5. **Sparse neon-orange illumination** — one accent per viewport region, never flood lighting.
6. **Product-interface evidence** — real screenshots of the beta (upload, playlist results, analysis dashboard) treated as first-class visuals.
7. **Large typographic statements** — Helvetica uppercase for structure, Benzin Bold for a single display statement per page.

Prohibited interpretations are listed in §40.

## 8. Color roles and theme mappings

[REPO] Authoritative tokens as defined in `apps/landing/src/index.css` (`:root` = dark default; `.light` = overrides):

| Token | Dark value | Light value | Role |
|---|---|---|---|
| `--color-primary` | `#ffffff` | `#000000` | Foreground text/strokes |
| `--color-primary-hover` | `#B9B9B9` | `#B9B9B9` | Hover foreground (brand Light Gray) |
| `--color-primary-background` | `#111111` | (inherits) | Page/panel background |
| `--color-noise-background` | `#242423` | (inherits) | Noise panel fill |
| `--color-noise-border` | `#50504F` | (inherits) | Noise panel border |
| `--color-secondary` | `#000000` | `#ffffff` | Inverse surface |
| `--color-text-primary` | `#000000` | `#ffffff` | Text on inverse surface |
| `--color-text-secondary` | `#ffffff` | `#000000` | Secondary text |
| `--color-neon-orange` | `#EE4A26` | (inherits) | Sole accent |
| `--opacity-10`…`--opacity-95` | black-based rgba | white-based rgba | Transparency scale |

[REPO] The webapp's `index.css` differs (`--color-primary-background: #000`, adds `--color-secondary-background: #111111`, `--color-light-theme`). The engineering instructions' token list (`--color-secondary-background`, `--color-text-secondary`, …) matches the **webapp** more closely than landing. New landing pages use the **landing** token set only.

[APPROVAL] The brand book's Space Black is `#101010`; landing uses `#111111`, webapp `#000000`. Aligning to `#101010` is a visible global change and is **not** proposed for this phase — listed as an open decision.

[EXT] Role rules for new pages: neon orange is reserved for the primary CTA, active/highlight states, and at most one illustrative glow per page; body copy is never orange; do not introduce new color values.

## 9. Typography roles and hierarchy

[BRAND]+[REPO] Three brand families, all present in `apps/landing/public/fonts/` and declared in `apps/landing/src/styles/fonts.css`:

| Family | Utility | Role |
|---|---|---|
| Helvetica Neue | `font-helvetica` | Headlines (usually `uppercase` + `font-light`/`font-medium`) and body copy |
| Fira Code | `font-fira` | Metadata, technical labels, terminal content, button labels, `LinkButton` items |
| Benzin Bold | `font-benzin` | Selective display statements only |

[REPO] Benzin is currently used only for: hero display lines (`HomeHero`, `AboutHero`, `UploadHero`), the footer "Join the Resomix Universe" watermark, and the mobile menu title. **Rule: at most one Benzin display statement per page; Benzin never in navigation, body copy, or buttons.** The task brief's caution is confirmed: Benzin does not replace the Helvetica headline system.

[REPO][APPROVAL] `fonts.css` also ships **Auger Mono** and **Montserrat**, which are absent from the brand book. Recommendation: do not use them on new pages; whether to remove them from the font payload later is an open decision (not this phase).

[EXT] Hierarchy for new pages (all sizes via `--px-*` tokens, see §13):

- Display (Benzin, 1 per page) → H1 (Helvetica light uppercase) → H2 section titles (Helvetica light uppercase, smaller) → H3/labels (Fira Code uppercase, tracked) → body (Helvetica light/regular, sentence case) → micro/metadata (Fira Code).
- One `<h1>` per page; heading levels never skip.

## 10. Logo variants and selection rules

[BRAND] Variant selection:

| Context | Variant |
|---|---|
| Header/navbar, wide layouts | Main logotype |
| Narrow placements (cards, square OG images) | Compact logotype |
| Favicons, avatars, small UI marks, repeated use | Signet (brand book: "use signet frequently") |
| Oversized background/pattern treatments | Outline logotype or outline signet |

[REPO] Existing assets: `apps/landing/src/assets/icons/logo_header.svg` (wordmark, used by `src/components/LogoHeader.tsx`, colored via `currentColor`), `r_icon_footer.svg` (signet, `LogoRFooter.tsx`), `assets/icons/hero/resomix.svg` (hero wordmark), `public/logo.png` (favicon). No compact-logotype or outline-variant asset exists in the repository yet — see §42.

## 11. Safe-space and minimum-size guidance

[BRAND] Maintain the protective field from brand book p.3 (® marker unit) around every logo placement; nothing may enter it. Minimum widths (p.7): logotype 50px recommended / 25px absolute; compact 50px / 25px; signet 80px / 50px.

[EXT] Because the site uses fluid rem, express logo sizes in `--px-*` tokens whose 1280px-reference rendering respects those pixel minimums at the smallest supported viewport (min root font-size 12.8px desktop / 10px mobile ⇒ check the computed size at clamp minimum, not the reference size).

## 12. Layout grid and maximum-width behavior

[REPO] There is no column grid system. Layout is: full-bleed dark field, `SideLines` dotted frame (left/right verticals at `--px-63` inset), content composed per-section with token-based paddings. Fluid width is bounded by `--max-width: 2560px` desktop (`.w-fluid-1280` = `clamp(1280px, 100vw, 2560px)`), mobile bounded at 1023px.

[EXT] New pages keep this model: sections span the frame, content aligns to the `--px-63` frame inset (desktop) / `--px-20` (mobile) as used by existing sections. No new grid framework, no centered "max-w-screen-xl card site" pattern.

## 13. Fluid sizing and token usage

[REPO] Verified implementation (quote from `apps/landing/src/index.css`):

```css
html { font-size: clamp(12.8px, 1.25vw, 32px); }              /* desktop, authored at 1280 */
@media (max-width: 1023px) {
  html { font-size: clamp(10px, 4.07vw, 41.6px); }            /* mobile, authored at 393 */
}
```

Note: the supplied engineering instructions state the mobile max as `26px`; the repository says `41.6px`. The repository value is authoritative (recorded as drift in `docs/IMPLEMENTATION_RULES.md` §34).

[REPO] All fixed measurements use `var(--px-N)` from `apps/landing/src/styles/pixels.css` (~273 tokens incl. fractional steps like `--px-10-37`). Missing steps are added to `pixels.css`, never inlined.

Rule (clarified per Phase 1 direction):

> Fixed visual measurements — spacing, fixed dimensions, offsets, typography sizes, border radii, and similar authored values — must use approved project tokens. Semantic layout values such as `auto`, `100%`, `fr`, `minmax()`, `min-content`, `max-content`, and other behavior-oriented layout expressions remain valid.

Generic Tailwind spacing/type classes (`p-4`, `w-64`, `text-sm`) are prohibited; the codebase has zero of them by convention.

## 14. Responsive design philosophy

[REPO]+[EXT] Desktop/mobile parity is mandatory. **One responsive component is the default** (base classes = mobile, `lg:` = desktop, both token-sized). Separate `desktop/`+`mobile/` files only when DOM order, nesting, behavior, or data genuinely diverge — the pattern currently used by Home/About (landing) and Upload/Playlist (webapp). Breakpoint: 1024px via `useResponsive` (`packages/hooks/src/useResponsive.ts`, `window.innerWidth >= 1024`). Existing split trees must be updated and tested together. The instructions' §8 warning stands: splitting is the main source of bugs.

Recommendation for the 15 new pages: single responsive components; the informational content does not justify split trees. [EXT]

## 15. Section spacing and vertical rhythm

[EXT] Adopt from existing sections: generous vertical intervals (order of `--px-150`–`--px-250` between desktop sections, as in Home/About), hero given a full first viewport, footer preceded by large clearance (`GlobalMobileFooter` uses `mt-[var(--px-250)]`). Exact per-page rhythm belongs to the page briefs; tokens only.

## 16. Dotted borders and dividers

[REPO] The dotted line is the brand's structural signature (45 files): `border border-dotted border-slate-200`, with `/60` and `/30` opacity suffixes for hierarchy; dividers as `border-t border-dotted`. `DottedLine` and `SeparatorLine` exist in `packages/ui/src/Vectors/`. New pages reuse this exact vocabulary; do not introduce solid or dashed hairlines except the existing `SideLines` frame SVG.

Note: dotted borders use Tailwind's `slate-200` literal rather than a color token — an existing convention to keep, not "fix". [REPO]

## 17. Surfaces and backgrounds

[REPO] Surfaces: the global dark field (`--color-primary-background`), noise panels (`--color-noise-background` + `--color-noise-border`), and inverse panels (`--color-secondary`). [EXT] New pages use flat token surfaces with dotted delineation instead of card elevations; no shadows (brand book p.8 "don't add special effects" extends to UI panels), no glassmorphism.

## 18. Static noise, texture, and depth

[REPO] The current `StaticNoise` (WebGL "Seagull Nebula", brand-colored `#EE4A26` accents) is mounted **once per app by the layout** (`LandingLayout.tsx`). Pages must never mount a second global instance. **Status: audited legacy implementation** — its atmosphere is valuable, but its stars, nebula animation, shooting star, and continuous rendering are not part of the approved future direction (§45); production migration requires a separate surgical task (IMPLEMENTATION_RULES §38), and no page runs both systems simultaneously. `SITE_USAGE.md` and `STABILITY_PLAN.md` document its GPU cost and a known multi-tab WebGL-context risk — new pages must not add further per-page WebGL. Local decorative instances exist historically (`HomeSix`) but are not a license for new ones. [EXT] Depth on new pages comes from layering: noise (z-1) → content (z-15/20/30) → frame inset (z-[60]) → navbar (z-[70]).

## 19. Iconography

[BRAND] The custom technical line-icon set (p.9) is the reference style: thin strokes, geometric, signal/resonance metaphors. [REPO] Existing SVG icons live in `apps/landing/src/assets/icons/` (e.g., `sound.svg`, `reference.svg`, `matches.svg`, `analysis.svg`) and are imported as modules. [EXT] New page icons follow the p.9 style, monochrome `currentColor` where feasible, stored in `assets/icons/`, never pasted as raw inline `<svg>` markup in pages. No third-party icon library is introduced. [APPROVAL] Producing the p.9 icon set as SVG assets (they are not in the repo) requires design approval — see §42.

## 20. Product screenshots and interface evidence

[EXT] Product truth beats illustration: Sonic Discovery and Track Intelligence pages should show real beta interface captures (upload panel, scored playlist table, analysis dashboard). Screenshots are taken in dark theme, framed with the dotted-border vocabulary, and must not show data the `DEMO_MODE` redaction exists to protect. Screenshots of the analysis dashboard must respect that its data is currently a hardcoded sample (`apps/webapp/src/pages/analysis/useTrackAnalysis.ts`) — allowed as interface evidence, but no accuracy claims may be attached ([see PAGE_BRIEFS product-truth legend]). [APPROVAL] Which screens may be shown publicly requires product approval.

## 21. Data visualisation principles

[EXT] Charts/diagrams on marketing pages follow the analysis dashboard's language: monochrome strokes on dark, Fira Code axis labels, orange reserved for the single highlighted series/point. No decorative dashboards, no fabricated metrics — every visualized number must come from the product or be clearly schematic (unlabeled axes).

## 22. Signal, waveform, orbital, and connection motifs

[EXT] Approved motif set (derived from brand icons p.9, mockups pp.10–12, and existing composites/animations such as `SineWaves`, `GoldenSpiral`, `Terrain`):

- Waveform and frequency patterns tied to the content (e.g., a reference track's profile), never generic decoration
- Orbital/resonance rings; connected data points (track-similarity graphs)
- Signal paths/trajectories between nodes (platform-integration diagrams)
- Technical coordinate/readout labels in Fira Code

Each page uses at most one dominant motif; motifs must relate to the section's claim (§40 prohibits decorative waveforms).

## 23. Motion and reduced-motion rules

[REPO] Existing motion: section-level animations mount only when visible (`useOnScreen`), page transitions via layout remount, `CodeTyping` in the footer. [EXT] New pages: purposeful, restrained motion only — reveal-on-scroll and typed labels are acceptable; no parallax, no looping attention-seeking animation, no new WebGL. All new motion must respect `prefers-reduced-motion` (provide a static end-state). [APPROVAL] Any new animated hero element needs design approval.

## 24. Buttons and CTA hierarchy

[REPO] Existing button system (reuse; do not fork):

| Component | Use |
|---|---|
| `ButtonHeavyRight` / `ButtonHeavyLeft` | Primary CTA (pill, Fira Code label, animated arrow; Right = forward action) |
| `ButtonSleek` | Secondary CTA / auth actions |
| `LinkButton` | Tertiary `[bracketed]` Fira Code text links (nav, inline) |
| `IconButton`, `ToggleButton`, `RoundContainer` | Utility |

[EXT] CTA hierarchy per page: exactly one primary CTA (`ButtonHeavyRight`), at most one secondary hero CTA (`ButtonSleek` or `ButtonHeavyLeft`), tertiary links as `LinkButton`. CTA labels and destinations are governed by `docs/WEBSITE_ARCHITECTURE.md` §24.

## 25. Links and navigation states

[REPO] `LinkButton` renders `[label]` in Fira Code at `--px-10`, `opacity-70` → `100` on hover; hover foreground `--color-primary-hover`. [EXT] New pages keep this vocabulary; the current-page nav item gets full opacity + orange marker (new state — small extension). Focus states must be visible (see §38).

## 26. Forms

[REPO] Form primitives exist in `packages/ui/src/Elements/`: `FormInput`, `PasswordInput`, `FormError`, `SearchInput`, `StatusMessage`; modal variants in `Modals/`. The partner registration form on `PartnersPage` (via `usePartners`) is the reference enterprise form. [EXT] New pages introduce no new form primitives; any new form (e.g., pilot inquiry) composes existing elements and is deferred until its backend destination is approved.

## 27. Cards, panels, and callouts

[EXT] Panels are dotted-bordered token surfaces (§16–17). Cards are used sparingly — never as "the answer to every section" (§40). Callouts: Fira Code label + dotted left border. No rounded-corner inflation: radii only via existing token values found in current components (buttons are the exception as pills).

## 28. Hero patterns

[REPO] Existing heroes: full-viewport, Benzin/Helvetica display statement, technical Fira Code sub-labels, one motif or composite graphic, `SideLines` hero slot on eligible modes (`about|upload|playlist|home` — see `SideLines.tsx:12`). [EXT] New-page hero pattern: H1 (Helvetica uppercase) + one-line subhead + primary CTA (+ optional secondary) + one motif/interface visual; optional Benzin display fragment. Hero imagery may load eagerly with high fetch priority (exception to lazy-loading; recorded in IMPLEMENTATION_RULES §12).

## 29. Product-page section patterns

[EXT] Recommended order (detailed per page in `docs/PAGE_BRIEFS.md`): Hero → what it is (plain language) → how it works (3–5 steps, signal motif) → interface evidence → capability boundaries/availability status → audience routing links → CTA block. Availability statuses use the product-truth legend, rendered as Fira Code status labels (e.g., `status: beta`).

## 30. Solution-page patterns

[EXT] Order: Hero (audience-named problem) → outcome statements mapped to product surfaces → workflow evidence → proof/boundary (honest beta framing) → cross-links to the two relevant product pages → CTA block. Audience pages differ by problem framing, not by layout novelty.

## 31. Partner and enterprise-page patterns

[EXT] Order: Hero (business outcome) → engagement model (pilot steps as numbered Fira Code protocol, echoing the existing PartnersPage 8-step carousel) → integration surface summary → trust/rights posture (only approved claims) → contextual CTA (`Start a Catalogue Pilot` / `Book a Partner Demo`). Enterprise pages may not carry the self-serve "Try Resomix" as primary.

## 32. Developer-page patterns

[EXT] Order: Hero (what you can build) → endpoint/flow overview (Fira Code, code-like blocks) → sandbox path (existing `/partners` sandbox flow is the verified mechanism) → links to docs (destination unresolved — see WEBSITE_ARCHITECTURE §23) → commercial context link. Code samples are display-only this phase; no live consoles.

## 33. Mega-menu design behavior

[APPROVAL]+[EXT] The proposed Product/Solutions/Partners/Developers/Company navigation does not exist; the current shared `Navbar` renders three fixed `LinkButton`s. Proposed behavior: full-width dark panel below the navbar (z-[70] layer), dotted top border, columns of `LinkButton`-style entries with one-line Fira Code descriptors; Solutions panel is two-group ("For individuals" / "For businesses"). Opens on click (not hover-only), closes on Esc/outside click, fully keyboard-navigable. This is a **new shared-component design requiring approval**, and its implementation touches `packages/ui/src/Layout/Navbar.tsx`, which is consumed by both apps (consumer-inspection rule applies).

## 34. Mobile navigation behavior

[REPO] Current: `MobileNavbar` (logo + hamburger) opens the full-screen `MenuPage` overlay (z-[100]). [EXT] Proposed: keep the full-screen overlay pattern; replace the flat link list with collapsible groups mirroring the five desktop groups, followed by auth actions and one primary CTA. Same dotted separators (`menu_separator.svg`). [APPROVAL] Grouped-accordion design needs approval; `MenuPage` is app-local so the change is landing-only.

## 35. Footer design behavior

[REPO] The terminal-style `GlobalFooter` (Benzin watermark, `CodeTyping` info blocks, support/contact/privacy links) is a strong brand asset. [EXT] Proposal: keep the terminal identity, add a compact dotted-separated link matrix for the new IA (Product / Solutions / Partners / Developers / Company / Legal) above the existing terminal block. [APPROVAL] Footer is shared by both apps — extension requires approval + consumer inspection.

## 36. Dark-theme requirements

[REPO] `:root` is dark by default; dark is the primary art direction (brand mockups are all dark). All new pages are designed dark-first and must render correctly with the noise background visible beneath content (`z-15+`).

## 37. Light-theme requirements

[REPO] `.light` overrides exist and both themes must remain supported (engineering instructions §7.2 "Test both"). Note: `.light` does not re-declare `--color-primary-background`/`--color-noise-*`; verify every new section in both themes. [APPROVAL] If any new page cannot honor light theme (e.g., screenshot-heavy sections), the exception must be approved rather than silently shipped.

## 38. Accessibility and contrast

[EXT] Requirements for new pages: body text meets WCAG AA against `#111111` (white and `#B9B9B9` pass; `#EE4A26` on `#111111` is ~4.0:1 — acceptable for large text only, never body copy); visible focus states on all interactive elements; heading order intact; nav and mega-menu keyboard-operable; motion respects `prefers-reduced-motion`; landing already ships `test:a11y` (axe) — new pages must pass it.

## 39. Image loading and alternative-text guidance

[REPO] Assets imported as modules from `src/assets/{icons,images,gifs}`; decorative images `alt="" aria-hidden="true"`; informative images real `alt`; `draggable={false}`. [EXT] Clarified loading rule: below-the-fold raster images use `loading="lazy"`; above-the-fold hero imagery may use eager loading + `fetchpriority="high"` when justified. (The instructions' blanket "always lazy" is adjusted; recorded as a deliberate clarification in IMPLEMENTATION_RULES §35.)

## 40. Prohibited visual patterns

[EXT] Consolidated prohibition list (brand + Phase 1 direction): literal planets; astronauts; stock galaxy photography; decorative stars scattered across sections; purple/blue "AI" gradients; glassmorphism; generic SaaS/AI illustrations; random glowing orbs; excessively rounded cards; card grids as the default section answer; borders around every element; meaningless dashboards; decorative waveforms unrelated to content; heavy parallax; excessive/playful motion; drop shadows or logo effects [BRAND p.8]; logo stretching/recoloring [BRAND p.8]; second `StaticNoise`, duplicate frame, page-level Navbar/Footer [REPO layout ownership]; any visual language disconnected from the current application.

## 41. Mapping to existing repository tokens and components

Summary of where each design need maps (details in IMPLEMENTATION_RULES):

| Need | Existing implementation |
|---|---|
| Colors/opacity | `apps/landing/src/index.css` tokens (§8) |
| Sizing | `apps/landing/src/styles/pixels.css` `--px-*` |
| Fonts | `fonts.css` utilities `font-helvetica/fira/benzin` |
| Buttons/links | `packages/ui/src/Buttons/*` |
| Frame/noise/nav/footer | `packages/ui/src/Layout/*`, `Animations/StaticNoise` |
| Dividers | `Vectors/DottedLine`, `SeparatorLine`, border-dotted utility pattern |
| Forms | `Elements/*` |
| Section scaffolding | `sections/{desktop,mobile}/<Page>/` convention |

Known token-level conflicts: brand `#101010` vs repo `#111111`/`#000000` (§8); instructions' mobile clamp max 26px vs repo 41.6px (§13); instructions' token list vs landing's actual set (§8).

## 42. Missing design primitives

Not present in the repository; required or desirable for Phase 1 (nothing may be invented as if it exists):

1. Mega-menu / dropdown navigation component (§33) — **required**
2. Grouped mobile menu (§34) — **required**
3. Compact logotype, outline logotype, outline signet as SVG assets (§10) — required for OG images/small placements
4. Brand icon set from p.9 as SVG assets (§19)
5. Status-label primitive for product-truth badges (§29) — can be a minimal Fira Code text pattern, no new component strictly needed
6. Footer link-matrix extension (§35)
7. Per-page metadata mechanism (see WEBSITE_ARCHITECTURE §23 / IMPLEMENTATION_RULES §29)

## 43. Items requiring design approval

1. Mega-menu pattern and its shared-`Navbar` impact (§33)
2. Mobile grouped-menu redesign (§34)
3. Footer extension (§35)
4. Space Black alignment `#111111`/`#000000` → `#101010` (defer or adopt) (§8)
5. Public use of product screenshots, incl. the sample-data analysis dashboard (§20)
6. Creation of missing logo-variant and icon assets (§42)
7. Fate of off-brand font families Auger Mono / Montserrat (§9)
8. Any new hero animation (§23)
9. Light-theme exceptions, if any (§37)

---

## 44. Upgraded visual direction (pending design-lab approval)

The upgraded Resomix-native visual system — product-evidence panels, branded data visualisation, catalogue schematics, platform signal maps, outline typography bands, film/noise treatment, and orange active-state rules — is defined and demonstrated in **`docs/design-lab/`** (`RESOMIX_VISUAL_DNA.md`, `VISUAL_UPGRADE_SYSTEM.md`, `APPROVED_VISUAL_MOTIFS.md`, `DIRECTION_RECOMMENDATION.md`, `prototype/`). That material is a **draft approval source** until the user approves it through the gates in IMPLEMENTATION_RULES §37; on approval its rules are merged into this document as the governing visual sections. Until then, the verified sections §1–§43 of this document remain the only binding visual rules.

## 45. Background architecture (Draft — awaiting design approval)

All rules in this section are **Draft — awaiting design approval** through the design-lab gates (4A–4C).

1. **Resomix Void Field.** The background is one unified system with five static-first layers (base plate · film grain · structural depth · page motif · active illumination) and three modes: **Pure** (fallback: trust/mobile/reduced-motion), **Structured** (the shared global background), **Product Activated** (approved flagship sections). Definition and demonstration: `docs/design-lab/void-field-study/`.
2. **Film/noise treatment.** The film/grain is identity and remains — as a static, opacity-capped, theme-aware texture; one instance, layout-owned; no legibility loss (draft caps in `PREMIUM_VISUAL_CRAFT_STANDARD.md` §7).
3. **Page-specific motif overlays.** Low-opacity product-derived overlays (waveform branch, analysis bands, relationship fragment, API path) may sit behind flagship sections only, activated by section visibility, draw-once.
4. **No persistent random star field.** Star grids, shooting stars, and nebula figures are retired on new pages; the space concept is expressed through scale, depth, structure, and controlled illumination (corrected concept, `BACKGROUND_SYSTEM_OPTIONS.md`).
5. **No decorative continuous WebGL.** No always-running GPU loop may exist for atmosphere on new pages; the existing `StaticNoise` remains untouched on existing pages until the background implementation gate (IMPLEMENTATION_RULES §38) decides its migration.
6. **Mystery and depth** come from partial reveal, distant low-opacity layers, dark-to-legible transitions, and restraint — per the Premium Visual Craft Standard (mystery must never cause confusion).
7. **Background performance.** Draft measurable targets live in `docs/design-lab/PERFORMANCE_BUDGET_PROPOSAL.md` (idle ≈0% background CPU, zero persistent animated layers, hidden-tab zero work, reduced-motion static parity) — pending engineering validation.

---

## Open decisions

- Space Black value alignment (brand `#101010` vs repo `#111111`/`#000000`).
- Whether Auger Mono / Montserrat remain shipped.
- Mega-menu interaction details (click vs hover-intent) pending design approval.
- Which product screenshots are publicly usable.
- The upgraded Resomix-native visual direction (intensity level, primitives) — decided through `docs/design-lab/` gates.

## Required confirmations

- Design approval for §43 items before any Phase 2 implementation.
- Product confirmation of screenshot policy (§20).
- Confirmation that both themes remain mandatory for the new pages (§36–37).

## Change history

- 2026-07-22 — Revision 4: added §45 Background architecture (draft, pending design-lab gates). Author: Claude.
- 2026-07-22 — Revision 3: visual direction reset — removed the rejected externally-referenced cinematic section (§44) and all references to the rejected prototype (archived at `docs/archive/rejected-trionn-direction/`); final visual direction now pending `docs/design-lab/` approval. Author: Claude.
- 2026-07-22 — Revision 2: added (later rejected) cinematic direction section; British public spelling. Author: Claude.
- 2026-07-22 — Initial draft proposal (Phase 1 foundation task). Author: Claude.
