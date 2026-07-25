# Resomix Web Implementation Rules

Status: Draft proposal — awaiting approval (revision 3 — visual direction reset)
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Governs how the approved Phase 1 pages will later be implemented in `apps/landing`. Derived from the supplied `Resomix Web — Engineering Instructions`, verified line-by-line against the repository; where they disagree, the repository is authoritative and the difference is recorded (§34–35). No rule here changes code in this phase.
Primary sources: supplied `Resomix Web — Engineering Instructions`; root `package.json`, `pnpm-workspace.yaml`, `turbo.json`; `apps/landing/{package.json,vite.config.ts,tsconfig.app.json,src/App.tsx,src/index.css,src/styles/*,src/components/Layout/LandingLayout.tsx,env.example}`; `apps/webapp/src/{App.tsx,components/Layout/WebLayout.tsx}`; `packages/{ui,hooks,stores,api-client,config}/src`
Last reviewed: 2026-07-22

---

## 1. Purpose and authority

Binding engineering rules for implementing the approved Phase 1 marketing pages. Applies to `apps/landing` and any approved shared-package changes. `apps/webapp` and `apps/admin` are out of scope except as consumers to inspect before shared changes.

## 2. Repository map

Verified:

| Path | Responsibility | Deployment |
|---|---|---|
| `apps/landing` | Marketing site, i18next | resomix.com |
| `apps/webapp` | Product app, no i18n | beta.resomix.com |
| `apps/admin` | Internal admin (antd — different stack; never copy patterns in/out) | internal |
| `packages/ui` | Shared components + design-system implementation | shared |
| `packages/hooks` | Shared behavior/data hooks | shared |
| `packages/stores` | Zustand stores | shared |
| `packages/api-client` | Typed backend wrappers + `authClient` | shared |
| `packages/config` | `VITE_*` env → typed constants | shared |

Caveat (drift, §34): `@resomix/stores` is used by landing but missing from landing's `package.json` dependencies, Vite aliases, and tsconfig paths (resolves via pnpm hoisting only). Do not "fix" this without an approved task.

## 3. Current stack

pnpm workspaces (`pnpm@10.13.1`) + Turbo 2 + Vite 7 + React 19 + React Router (`react-router-dom@^6.23`, v7 future flags on) + Tailwind CSS v4 (CSS-first: `@import "tailwindcss"` + `@source`; minimal legacy `tailwind.config.ts` kept per app for font families) + TypeScript ~5.8. Packages are vite-aliased to their `src/` — edits are live, no package rebuild.

## 4. Local-development commands

Verified from root `package.json`:

```bash
pnpm install
pnpm dev:landing    # :5173
pnpm dev:webapp     # :5174
pnpm dev:admin      # :5175
pnpm build:landing  # TURBO_DISABLE_DAEMON=1 turbo run build --filter=landing
pnpm build:webapp
pnpm test / test:unit / test:e2e / lighthouse / validate:html   # turbo run …
```

Landing app also has: `lint`, `test:a11y`, `lighthouse:mobile|desktop`, `preview`. Note: `test`/`lighthouse`/`validate:html` are invoked at root but not declared as tasks in `turbo.json` (drift, §34).

## 5. Environment-variable rules

- Each app reads its own `apps/<app>/.env`; `.env` is gitignored; `env.example` committed.
- Only `VITE_*` values reach the browser; **no secret ever goes in one**.
- Values are exposed via `@resomix/config` (`BASE_LANDING_URL`, `BASE_BETA_URL`, `SERVER_BACKEND`, `SERVER_MEDIA`, social URLs, `DEMO_MODE`); restart the dev server after edits.
- `VITE_SERVER_BACKEND` defaults to `https://bserver.resomix.com` in `api-client` if unset — a missing value silently targets production.
- Verified `env.example` drift: landing's example still lists `VITE_PUBLIC_POSTHOG_KEY/HOST` (referenced nowhere in code) and omits `VITE_GOOGLE_CLIENT_ID` (used in landing `App.tsx`/`AuthPage.tsx`). Use the supplied instructions' §1b tables, not the stale examples.
- **No new environment variable is expected for the Phase 1 informational pages.** Any exception needs separate approval and must update `env.example` + the instructions table.

## 6. Import aliases

- `@/` → current app's `src/`; `@resomix/*` → workspace packages. Zero `../../` imports exist in landing/webapp — keep it at zero. Same-folder `./x.tsx` is fine.
- Verified aliases (landing `vite.config.ts` + `tsconfig.app.json`): `@`, `@resomix/ui`, `@resomix/hooks`, `@resomix/api-client`, `@resomix/config`. `@resomix/stores` has no alias (drift, §34) — it still imports correctly via workspace resolution; match existing usage.

## 7. Barrel-export rules

Verified barrels and the registration matrix:

| You add | Update |
|---|---|
| Shared component | `packages/ui/src/index.ts` — explicit import **and** export blocks (both) |
| Shared hook | `packages/hooks/src/index.ts` (+ domain `index.ts` where the folder has one) |
| Store | `packages/stores/src/index.ts` |
| API function | its module + `packages/api-client/src/index.ts` |
| Landing component | `apps/landing/src/components/index.ts` |
| Landing page | `apps/landing/src/pages/index.ts` |
| Landing section | `apps/landing/src/sections/{desktop,mobile}/index.ts` |

Clarification: public additions must be exported through the correct barrel; implementation-internal files may use direct local imports to avoid circular dependencies. Barrel updates must not introduce import cycles (verify with a build). Known pre-existing exception: `SubscribePage` is lazily imported in `App.tsx` but absent from the pages barrel (drift, §34) — do not replicate.

## 8. Shared-component reuse

Read `packages/ui/src/index.ts` before building anything. Verified families: Buttons (`ButtonHeavyLeft/Right`, `ButtonSleek`, `LinkButton`, `IconButton`, `ToggleButton`, `RoundContainer`) · Elements (`FormInput`, `PasswordInput`, `FormError`, `SearchInput`, `SearchDropdown`, `StatusMessage`, `ProfileDropdown`, `IconComp`, `TextComp`, banners…) · Modals (`StatusModal`, `ConfirmModal`, `InputModal`) · Layout (`Navbar`, `MobileNavbar`, `SideLines`, `GlobalFooter`, `GlobalMobileFooter`, `InfoPageLayout`, `Tooltip`, `WelcomeMessage`, `TermsAcceptance`) · Content (auth/info content set, `Error404`…) · Billing · Auth · Animations (incl. `StaticNoise`) · Vectors (`DottedLine`, `SeparatorLine`…).

Rules: reuse when a component satisfies the requirement; extend with a backwards-compatible prop when multiple consumers need a variant (never fork); **never modify a shared component without enumerating its current consumers in both apps and assessing compatibility** (e.g., `Navbar` and `GlobalFooter` are mounted by `LandingLayout.tsx` and `WebLayout.tsx` — any nav redesign is a cross-app change).

## 9. Component placement

- Used by more than one app or page → `packages/ui` (exported via barrel).
- Genuinely landing-specific → `apps/landing/src/components/` or a page's section folder.
- A component moves to `packages/ui` only after demonstrated cross-page/cross-app use — not speculatively.

## 10. Hook and state-management rules

- Components render; loading, retries, polling, caching, mutations, and reusable behavior live in hooks (`packages/hooks/src/<Domain>/`).
- Shared client state: Zustand stores in `packages/stores`; hot-path access via selectors (`useAuthStore(s => s.isAuthenticated)`).
- **The Phase 1 pages are informational: no new data-fetching, stores, or hooks without a real, approved requirement.** Expected page-level hook usage is limited to `useTranslation`, `useResponsive`, and existing navigation handlers.

## 11. API-client and authentication rules

HTTP belongs in `packages/api-client`; authenticated calls go through `authClient` (attaches Bearer token, serializes 401 refresh). A trivial page-specific one-shot read may call an API function directly where current conventions allow. Phase 1 pages should require **no** API calls; any form wiring (e.g., pilot inquiry) is a separately approved task.

## 12. Asset rules

- Assets live in `apps/landing/src/assets/{icons,images,gifs}` and are imported as modules; kebab/snake filenames; never hot-link remote assets; never paste raw `<svg>` markup into pages (import the `.svg`).
- Decorative images: `alt="" aria-hidden="true"`; informative images: useful `alt`; `draggable={false}` per existing convention.
- Loading (clarified from the instructions' blanket "always lazy"): below-the-fold raster images default to `loading="lazy"`; **above-the-fold hero imagery may use eager loading and `fetchpriority="high"` when justified** (deliberate adjustment, §35).

## 13. Fluid sizing

Verified root sizing (`apps/landing/src/index.css`):

```css
html { font-size: clamp(12.8px, 1.25vw, 32px); }               /* desktop, authored at 1280px */
@media (max-width: 1023px) { html { font-size: clamp(10px, 4.07vw, 41.6px); } }  /* mobile, authored at 393px */
```

All `--px-*` tokens are rem, so the UI scales continuously; no breakpoints for sizing. (Instructions state mobile max 26px; repo says 41.6px — repo wins; §34.)

## 14. Token usage

> Fixed visual measurements — spacing, fixed dimensions, offsets, typography sizes, border radii, and similar authored values — must use approved project tokens (`var(--px-N)` from `apps/landing/src/styles/pixels.css`, `var(--color-*)`, `var(--opacity-*)`). Semantic layout values (`auto`, `100%`, `fr`, `minmax()`, `min-content`, `max-content`, etc.) remain valid.

Missing steps are added to `pixels.css` (landing's copy — each app curates its own; they are not identical, §34). Never inline rem/px. Never use generic Tailwind spacing/type classes (`p-4`, `w-64`, `text-sm`).

## 15. Tailwind v4 conventions

No `@theme` blocks; utilities wrap tokens as arbitrary values; font-size needs the `length:` hint:

```tsx
className="text-[length:var(--px-17)] leading-[var(--px-20)] gap-[var(--px-40)] tracking-[var(--px-0-25)] font-light font-helvetica uppercase"
```

`apps/landing/src/index.css` has `@source "../../../packages/ui/src"` — classes generate only for files under the app `src/` and `packages/ui/src`. New shared components must therefore live under those roots to get their classes compiled.

## 16. Color and theme rules

Use only the landing token set (`--color-primary`, `--color-primary-hover`, `--color-primary-background`, `--color-noise-background`, `--color-noise-border`, `--color-secondary`, `--color-text-primary`, `--color-text-secondary`, `--color-neon-orange`, `--opacity-10…95`). `:root` is dark by default; `.light` overrides. Test both themes on every new section. Note the instructions/webapp token `--color-secondary-background` does **not** exist in landing (§34). Do not add or change token values in this project phase without approval (`#101010` alignment is an open design decision — DESIGN_SYSTEM §8).

## 17. Existing visual patterns

Preserve: dotted borders (`border border-dotted border-slate-200`, `/60`,`/30`), Helvetica/Fira/Benzin roles, `StaticNoise` mounted once by the layout, `SideLines` frame, z-index ladder (noise/frame `z-1` · content `z-15/z-20/z-30` · frame inset `z-[60]` · navbar `z-40`/`z-[70]` · mobile menu `z-[100]` · top overlays `z-[9999]`). Content needs `z-15`+ or the noise covers it. Never add a second global `StaticNoise`, duplicate frame, or page-level Navbar/Footer.

## 18. Responsive strategy

Resolved rule (supersedes the instructions' "two code paths" framing — deliberate adjustment, §35):

> Desktop/mobile parity is mandatory. One responsive component is the default when content structure and behavior are the same (base classes = mobile, `lg:` = desktop, token-sized). Separate desktop and mobile files are allowed only when DOM order, nesting, behavior, or data requirements genuinely diverge. Existing split implementations must be updated and tested together.

Breakpoint: 1024px via `useResponsive` (`packages/hooks/src/useResponsive.ts`). Existing splits: landing Home/About (pages + section trees), webapp Upload/Playlist. New Phase 1 pages: single responsive components recommended.

## 19. Page and section patterns

Verified archetypes: **Section page** (ordered sections; e.g., `AboutPage` renders `AboutHero`+`AboutOne…`), **Content page** (thin wrapper over a `@resomix/ui` Content component; e.g., `InfoPage mode="contact"`), **App page** (webapp only). New marketing pages are Section pages: sections named `<Page>Hero`, `<Page>One`, `<Page>Two`… in render order, living in `apps/landing/src/sections/{desktop,mobile}/<Page>/` **only if split** — single responsive components may live in one section tree (follow whichever structure the approved implementation task specifies; do not invent a third pattern). Pages render content only.

## 20. Layout ownership

`LandingLayout` owns Navbar/MobileNavbar, `StaticNoise`, `SideLines`, `GlobalFooter`/`GlobalMobileFooter`, scroll-to-top, page-transition remount, and the mobile `MenuPage` overlay. Pages never render these. `InfoPageLayout` exists in `packages/ui` but is unused by landing (webapp/info usage) — do not adopt it for new landing pages without approval.

## 21. Routing checklist

For each approved new page (all in `apps/landing/src/App.tsx`):

1. Create the page (§18 decides one file or split).
2. `lazy()` import at the top of `App.tsx`.
3. Add `<Route>` in the correct guard group — new marketing pages are plain (no guard).
4. **Update `LandingLayout`'s `mode` useMemo** — it maps pathname → mode and falls through to `'404'`; a missed entry renders the page with 404 chrome. (Most-missed step per the instructions; verified the fall-through in `LandingLayout.tsx`.)
5. Review `SideLines` mode semantics: hero-frame treatment applies to `about|upload|playlist|home`; decide and document the mode for each new page.
6. Review `Navbar` mode → CTA mapping (`home|contact|error|404` → "Upload Your Track", etc.): new modes currently render **no CTA** — the nav redesign task must handle this explicitly.
7. Update `pages/index.ts` barrel.
8. Add translation keys (landing copy is translated; §26).
9. Use `onNavigate`/layout helper for links; cross-app destinations via `BASE_BETA_URL` (full document navigation).

## 22. Layout mode requirements

Each new route needs an explicit entry in the `mode` mapping. Proposed mode naming for new pages (subject to the nav-redesign task): reuse the substring-after-slash pattern already used for `['/contact','/waitlist','/error','/partners','/pricing']`, extended to the new nested paths. The exact mapping table is produced in the implementation task, not invented ad hoc per page.

## 23. `SideLines` behavior

Verified (`packages/ui/src/Layout/SideLines.tsx`): `isHeroPage = mode === "about" || mode === "upload" || mode === "playlist" || mode === "home"` — hero pages skip the desktop top-frame SVG notch; others get the framed treatment. Mobile: bottom line only for `about|upload`; `hero` slot renders for `about|upload|playlist`. Default mode `"about"`. New pages get the framed (non-hero) treatment unless the approved design specifies otherwise; extending the hero list is a shared-component change (consumer inspection: webapp passes `upload|playlist|profile|auth|contact|error|404`).

## 24. `StaticNoise` behavior

Verified: WebGL nebula, mounted once by `LandingLayout` (currently on **all** breakpoints — a formerly desktop-only guard is commented out; §34). GPU-heavy (`SITE_USAGE.md`); multi-tab WebGL context limits documented in `STABILITY_PLAN.md`. Rules: pages never mount it; no new per-page WebGL; treat the noise as an owned service of the layout.

## 25. Cross-app navigation

> Navigation between `resomix.com` and `beta.resomix.com` is cross-origin and **requires full document navigation**, even when routed through the shared helper. Same-app destinations use client-side routing.

Verified in `LandingLayout.handleNavigate`: landing-domain paths → `navigate()`; beta/external → `window.location.href`. The instructions' claim that the helper keeps cross-app links "SPA transitions" is wrong for cross-origin targets (§35). Always build URLs from `BASE_LANDING_URL`/`BASE_BETA_URL` (`@resomix/config`). Do not copy `MenuPage`'s raw `window.location.href` pattern into new code (§34).

## 26. i18n rules

- `apps/landing` uses i18next: single namespace `common`, single language `en` (`src/locales/en/common.json`), detector + `fallbackLng: 'en'`.
- New page copy must use translation keys (`useTranslation('common')`, keys like `product.sonic_discovery.hero.headline`) — no hardcoded visible strings.
- Known drift (§34): existing **Home sections hardcode their copy** (no `t()` usage in `sections/desktop/Home/*`); About sections are translated. New pages follow the translated pattern; retro-fitting Home is a separate task.
- `apps/webapp` has no i18n; irrelevant to this phase.

## 27. Safe HTML translation behavior

Trusted repository-controlled translation strings may contain markup and are rendered via `dangerouslySetInnerHTML` (existing pattern, e.g. `AboutTwo.tsx:27`). Constraints: only repo-committed locale strings may flow through this path; API content, user input, CMS content, URL/query values, and any external data must never reach `dangerouslySetInnerHTML` without an approved sanitization layer. Keep markup in translations minimal (`<br/>`, inline emphasis).

## 28. Accessibility requirements

- Semantic heading order; one `<h1>` per page.
- Keyboard operability + visible focus for all interactive elements (incl. future menus).
- Image alt rules per §12; decorative SVGs hidden.
- Color contrast per DESIGN_SYSTEM §38 (orange never for body text).
- Motion respects `prefers-reduced-motion`.
- `pnpm --filter landing test:a11y` (axe) must pass for new pages.

## 29. SEO and metadata integration rules

Current state (verified): all metadata is static in `apps/landing/index.html` (title "Resomix Sonic Discovery", one description, canonical `https://resomix.com/`, OG basics, GTM + Silktide consent). There is **no** per-route title/meta mechanism (no helmet, no `document.title` writes). Rules for this phase: PAGE_BRIEFS defines per-page titles/descriptions/OG direction as **content**, but no SEO package, schema system, or prerendering is introduced. The minimal integration mechanism (e.g., a tiny `useDocumentTitle`-style hook vs build-time solution) is an **open technical decision** (§36) to be approved before Phase 2 implementation.

## 30. Change-control rules

- Smallest safe diff; no unrelated refactoring, formatting, file moves, or renames.
- No dependency or lockfile changes without explicit approval.
- No route, API contract, exported name, translation-key, or component-API changes outside the approved task.
- Shared-component changes require prior consumer inspection across landing **and** webapp (admin excluded by stack isolation but grep anyway).
- One coherent page or phase at a time; separate newly introduced errors from pre-existing ones in reports.
- A task is not complete while the target app's build fails.

## 31. Audit-first implementation process

Per page task: (1) read the page brief + this document; (2) inspect current routes/layout modes/sections it touches; (3) enumerate shared components used and their consumers; (4) list required assets/translation keys; (5) implement; (6) validate (§32); (7) report (§33).

## 32. Validation commands

```bash
pnpm --filter landing lint
pnpm --filter landing build        # tsc -b && vite build — must pass
pnpm --filter landing test:unit
pnpm --filter landing test:a11y
pnpm --filter landing validate:html   # on dist
git status --short && git diff --stat # scope check
```

Manual: both themes; 393px, 1280px, and ≥1920px; mobile menu; keyboard navigation.

## 33. Completion-report format

Every implementation task reports: files created/changed (paths); barrels updated; routes + layout modes added; translation keys added; shared components touched (+ consumer analysis); assets added; validation results (each §32 command); known gaps; pre-existing failures encountered (unfixed, listed separately); confirmation the diff contains only approved scope.

## 34. Known repository drift

Repository facts that differ from expectations or from clean convention (record only — fix nothing without approval):

1. Mobile root clamp max is `41.6px`, not `26px` (`apps/landing/src/index.css`).
2. `@resomix/stores` missing from landing `package.json`/aliases/tsconfig — works via hoisting.
3. Landing Home sections hardcode copy (no i18n); About sections are translated.
4. `SubscribePage` absent from `pages/index.ts` barrel; `/pricing` and `/subscribe` render the same content.
5. `env.example` drift: stale PostHog/`VITE_BASE_ADMIN_URL` entries; missing `VITE_GOOGLE_CLIENT_ID`, `VITE_ANALYSIS_*`.
6. `StaticNoise` renders on all breakpoints (desktop-only guard commented out) in both layouts; known GPU/multi-tab risk (`STABILITY_PLAN.md`).
7. `MenuPage` bypasses `handleNavigate` with raw `window.location.href` for internal links.
8. `pixels.css` differs per app (landing ~273 tokens, webapp ~272, incl. a duplicate `--px-850`); no shared token file.
9. Theme tokens live in each app's `index.css`, not `packages/ui` (`packages/ui/src/styles.css` is a bare Tailwind import); landing and webapp token sets differ (`--color-primary-background` `#111111` vs `#000`; `--color-secondary-background` webapp-only).
10. `tailwind.config.ts` files exist per app (legacy-style, fonts + content globs) alongside Tailwind v4 CSS-first setup.
11. Root has no base `tsconfig.json`; TS config is per-package.
12. `turbo.json` declares only `build` and `dev`; root `test`/`lighthouse`/`validate:html` scripts call undeclared turbo tasks.
13. Landing is English-only (`en/common.json`) despite full i18next wiring.
14. Off-brand fonts shipped (Auger Mono, Montserrat) — see DESIGN_SYSTEM §9.
15. Dormant/dead code: `TestPage`, commented `/test` route (landing); `CartPage`, `PlayerPage`, OAuth redirect pages with commented routes (webapp).
16. `docs/routes.md`, `docs/REUSABLE_COMPONENTS.md`, `docs/AUTH_FLOW.md` predate this proposal; they describe backend/auth/component details and do not conflict with these documents' scope (they remain authoritative for their own domains).

## 35. Differences from the supplied engineering instructions

Deliberate adjustments (each preserves intent; none weakens a rule silently):

1. **§0.8 "Desktop and mobile are two code paths"** → replaced by the parity-first single-component default (§18), matching the instructions' own §8 detail and the Phase 1 direction.
2. **§4 "always `loading="lazy"`"** → below-the-fold default; hero imagery may be eager with high fetch priority (§12).
3. **§10.7 cross-app links "stay SPA transitions"** → corrected: cross-origin navigation is always a full document load; only same-app links are SPA (§25).
4. **§7.2 mobile clamp `26px`** → repository value `41.6px` is authoritative (§13).
5. **§1b/§7.2 token list** → landing's actual token set differs (no `--color-secondary-background` in landing); documented in §16.
6. **§11 "No literal copy in landing sections"** → confirmed as the rule for new work, with the recorded exception that existing Home sections currently violate it (§26, §34.3).

Everything else in the supplied instructions was verified and stands as written.

## 36. Open technical decisions

1. Per-page metadata mechanism (§29) — minimal hook vs build-time; nothing may ship without it being chosen.
2. Mega-menu implementation approach for shared `Navbar` (extend with props/mode vs new landing-local header) — consumer analysis first; see DESIGN_SYSTEM §33.
3. `SideLines`/Navbar `mode` naming scheme for ~15 new routes (flat substring vs structured mapping) (§22).
4. Whether new pages use single-tree responsive sections (recommended) or the split `desktop/mobile` trees (§18–19).
5. Whether the `stores` aliasing gap (§34.2) is fixed as a hygiene task before page work.
6. Anchor-link behavior for `/partners#sandbox` / `#contact` CTAs (scroll handling with the layout's scroll-to-top on navigation) — verify during implementation.

## 37. Visual design approval gate

Replaces the previous (rejected) externally-referenced gate. No external website is a design authority; the visual direction is decided through the Resomix-native process in `docs/design-lab/`.

No production landing page may be implemented until:

1. The current Resomix audit is approved.
2. The Resomix Visual DNA is approved.
3. The upgraded visual system is approved.
4. The Product Overview prototype is approved.
5. Mobile and desktop references are approved.
6. Static layout is approved before motion.
7. Page-specific visual guidance is restored to PAGE_BRIEFS.
8. A separate surgical Cursor task is approved.

Engineering rules elsewhere in this document (tokens, layout ownership, no new dependencies without approval, accessibility, change control, validation) apply unchanged to whatever visual direction is approved.

## 38. Background implementation gate (draft)

No production background update may proceed until:

1. The current background performance audit is approved.
2. One shared background option is approved.
3. Mobile and reduced-motion fallbacks are approved.
4. Performance targets are approved.
5. The Product Overview static prototype is approved.
6. The existing pages are checked for compatibility.
7. A separate surgical Cursor task is approved.

Evidence and options: `docs/design-lab/BACKGROUND_SYSTEM_AUDIT.md`, `BACKGROUND_SYSTEM_OPTIONS.md`, `PERFORMANCE_BUDGET_PROPOSAL.md`. The existing `StaticNoise` component and its consumers are untouched until this gate clears.

---

## Open decisions

See §36. Additionally: approval of the six deliberate adjustments in §35.

## Required confirmations

- Confirmation that the repository (not the supplied instructions) is authoritative where §34/§35 record differences.
- Approval of §36 items before any Phase 2 implementation task is generated.

## Change history

- 2026-07-22 — Revision 4: added §38 Background implementation gate (draft). Author: Claude.
- 2026-07-22 — Revision 3: replaced the rejected cinematic gate with the Visual design approval gate (§37, design-lab process). No engineering rule weakened. Author: Claude.
- 2026-07-22 — Revision 2: added (later rejected) cinematic gate. Author: Claude.
- 2026-07-22 — Initial draft proposal (Phase 1 foundation task). Author: Claude.
