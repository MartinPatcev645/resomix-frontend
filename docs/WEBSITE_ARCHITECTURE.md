# Resomix Website Architecture

Status: Draft proposal — awaiting approval (revision 3 — design-neutral; visual direction pending docs/design-lab/)
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Governs information architecture, routes, navigation, and CTA strategy for `apps/landing` (resomix.com). Does not change `apps/webapp` routes. Page content details live in `docs/PAGE_BRIEFS.md`; visual rules in `docs/DESIGN_SYSTEM.md`; engineering rules in `docs/IMPLEMENTATION_RULES.md`.
Primary sources: `apps/landing/src/App.tsx`; `apps/webapp/src/App.tsx`; `apps/landing/src/components/Layout/LandingLayout.tsx`; `packages/ui/src/Layout/{Navbar,MobileNavbar,GlobalFooter}.tsx`; `packages/config/src/index.ts`; live external checks of `api-docs.resomix.com`, `support.resomix.com`, `resomix.com/blog` (2026-07-22)
Last reviewed: 2026-07-22

Language convention (revised decision, 2026-07-22): **British English for public marketing copy** — "Catalogue Intelligence", "Catalogue Pilot", "catalogue owner". Supporting evidence: the live Resomix Journal already uses this convention ("catalogue owners", "REQUEST_CATALOGUE_EVALUATION" — resomix.com/blog).

> **Public vs internal terminology.** Public marketing terminology: **Catalogue**. Existing internal/code terminology: may remain **Catalog** where already established (e.g. webapp UI strings "Demo Catalog", API fields, the developer hub's "catalog matches"). No code identifier, backend field, API property, or existing product string is renamed for spelling.

---

## 0. Revision 2 — route migration table

| Previous proposal | Revised proposal | Reason |
|---|---|---|
| `/product/catalog-intelligence` | `/product/catalogue-intelligence` | Public British spelling |
| `/product/discovery-api` | `/developers` | First-class technical/commercial journey |
| `/partners/catalog-pilot` | `/partners/pilot` | Shorter canonical route |
| `/partners/integration-options` | `/partners/integrations` | Shorter canonical route |
| `/partners/trust` | `/trust` | Cross-audience relevance (individuals, partners, evaluators) |
| `/solutions/curators` | `/solutions/curators-music-supervisors` | Explicit audience naming |
| `/solutions/music-platforms` + `/solutions/dj-software` | `/solutions/platforms-music-technology` | Initial combined launch page (split decision deferred) |
| — | `/api` → proposed redirect to `/developers` | Single canonical API overview; no duplicate content page |

None of the previous routes ever shipped, so no production redirects are required for the renames; `/api` is the only proposed redirect (plus the Phase 2 `/subscribe`→`/pricing` consolidation, §26 below).

## 1. Executive objective

Explain the complete Resomix platform and route every visitor toward the correct product, solution, or conversion path — within seconds. The site must present Resomix as a connected platform (discovery + intelligence + infrastructure), not only an upload-based track-similarity tool.

## 2. Current-state findings

Unchanged from revision 1 and re-verified at the same snapshot:

- Landing has 6 real content destinations (`/`, `/about`, `/partners`, `/pricing`≡`/subscribe`, `/waitlist`, `/contact`) plus auth/info routes; navigation is company/action-led (About Us / Waitlist / Journal + "Upload Your Track").
- Webapp is the product: upload/search/demo catalogue → scored similarity playlist (`/playlist`, alias `/sonic-discovery`); `/analysis` dashboard (currently hardcoded sample data); `/library`; `/subscribe` (server-driven plans + Stripe); full auth suite.
- Product terminology in the UI: "Sonic Discovery", "SCORED BY PYXIS-1", "Chain Discover", "sonic DNA", "Demo Catalog" (internal spelling), beta banners.
- Partner surface exists on `/partners` (8-step onboarding, sandbox key + curl, developer-registration form via `usePartners`).
- **New verified findings (2026-07-22):** a public **Resomix Developer Hub** is live at `https://api-docs.resomix.com/` ("B2B Audio Similarity API": public sandbox key `rmx_sandbox_demo`, quickstart curl against `sandbox.resomix.com/v1/similarity/query`, sections for ingestion similarity, catalog mapping, metadata audits, quickstart guide, endpoint explorer; states an open catalogue of 50,000+ CC-licensed tracks). A live **Help Center** exists at `https://support.resomix.com/` (Legal library v6/v7 dated 2026-07-05: Privacy, Terms, GDPR Summary, Cookie, AUP, DMCA, Refund, Platform Disclaimer, Open-Source Music & Licensing Transparency; operator: Reform Studios, Greece). The **Journal** is live at `https://resomix.com/blog/` (Ghost; British "catalogue" usage; partner CTA "REQUEST_CATALOGUE_EVALUATION" → `/blog/partners/`).

## 3. Audience hierarchy

1. **Individual music professionals** — DJs, producers, curators, music supervisors. Self-serve; converts to the beta.
2. **Catalogue and rights-side organisations** — labels, distributors, catalogue owners/managers, publishers, sync agencies, music libraries. Converts to pilot/demo conversations.
3. **Platforms and music-technology organisations** — music platforms, digital stores/marketplaces, DJ software companies, music-tech companies, sample-library providers. Converts to integration conversations.
4. **Technical and commercial evaluators** — developers, product managers, technical decision-makers, enterprise buyers, partnership/licensing teams. Cross-cutting; converts via `/developers` → sandbox and partner contact.

No audience must understand the platform architecture before finding its path.

## 4. Product hierarchy

| # | Surface | One-line definition | Truth status |
|---|---|---|---|
| 1 | **Sonic Discovery** | From a reference sound to scored, listenable matches | Live in current beta |
| 2 | **Track Intelligence** (powered by PYXIS-1) | Understand a track's sonic anatomy | Visible in current UI; sample-data phase |
| 3 | **Catalogue Intelligence** | Turn catalogue audio into searchable sonic intelligence | Partner/pilot; requires product confirmation |
| 4 | **Discovery API** (surfaced via `/developers`) | Integrate sonic analysis and discovery into your own product | Existing API + public sandbox (verified: developer hub live) |

## 5. Existing route inventory

Unchanged from revision 1 (verified against `apps/landing/src/App.tsx` and `apps/webapp/src/App.tsx`): landing `/`, `/about`, `/partners`, `/pricing`, `/subscribe`, `/waitlist`, `/contact`, `/auth/*` (guest + open), `/profile`·`/sessions`·`/change-password` (protected), `/error`, `*`; webapp `/`, `/playlist`(+`/sonic-discovery` alias), `/analysis` (protected), `/library` (protected), `/subscribe`, shared auth/info set. Duplicated across apps: `/auth/*`, `/profile`, `/sessions`, `/change-password`, `/subscribe`, `/contact`, `/error`, `/`, `*`.

## 6. Existing page-status inventory

| Page | Status |
|---|---|
| Home `/` | Existing but needs revision (Phase 2; only nav shell changes during Phase 1) |
| About `/about` | Existing and suitable (Company > About) |
| Partners `/partners` | Existing but needs revision → Partner Overview [P1-11]; anchors `#sandbox`/`#contact` preserved |
| Pricing `/pricing` + Subscribe `/subscribe` | Existing but needs revision (duplicate; consolidation §26, Phase 2) |
| Waitlist `/waitlist` | Existing; de-emphasise in nav — requires product confirmation |
| Contact `/contact` | Existing and suitable (utility) |
| Journal | External destination — **verified live** (`resomix.com/blog/`) |

## 7. Proposed canonical route map

```text
/                                        Home (existing; revision deferred to Phase 2)
/product                                 Product Overview                    [P1-1]
/product/sonic-discovery                 Sonic Discovery                     [P1-2]
/product/track-intelligence              Track Intelligence                  [P1-3]
/product/catalogue-intelligence          Catalogue Intelligence              [P1-4]
/developers                              Developers Overview                 [P1-5]
/solutions/djs                           DJs                                 [P1-6]
/solutions/producers                     Producers                           [P1-7]
/solutions/curators-music-supervisors    Curators & Music Supervisors        [P1-8]
/solutions/labels-distributors           Labels & Distributors               [P1-9]
/solutions/platforms-music-technology    Platforms & Music Technology        [P1-10]
/partners                                Partner Overview (revision)         [P1-11]
/partners/pilot                          Private Catalogue Pilot             [P1-12]
/partners/integrations                   Integration Options                 [P1-13]
/trust                                   Trust, Rights & Security            [P1-14]

/api                                     Proposed redirect → /developers (no content page)
```

Reserved later routes (do not build now): `/developers/quickstart`, `/developers/catalogue-ingestion`, `/developers/sandbox`, `/developers/webhooks`.

Notes: webapp's `/sonic-discovery` results alias lives on `beta.resomix.com` — different origin, no collision. `/developers` is the **sole canonical API overview**; the Product menu may link to it as supporting attribution but no second API page exists.

## 8. Route-status matrix

| Route | Classification |
|---|---|
| `/product`, `/product/*` (3) | Missing — Phase 1 |
| `/developers` | Missing — Phase 1 |
| `/solutions/*` (5) | Missing — Phase 1 |
| `/partners` | Existing but needs revision — Phase 1 |
| `/partners/pilot`, `/partners/integrations` | Missing — Phase 1 |
| `/trust` | Missing — Phase 1 |
| `/api` | Proposed redirect — Phase 1 (requires approval; trivial route entry) |
| `/` Home | Existing but needs revision — Phase 2 |
| `/about`, `/contact` | Existing and suitable |
| `/pricing`, `/subscribe` | Existing but needs revision — Phase 2 (§26) |
| `/waitlist` | Existing; de-emphasise — Requires confirmation |
| `/solutions/publishers-sync-libraries`, `/solutions/sample-libraries` | Missing — Phase 2 |
| `/solutions/music-platforms` + `/solutions/dj-software-music-technology` (split of P1-10) | Future decision — flagged, not planned |
| `/partners/brief`, `/partners/contact` | Missing — Phase 2 |
| `/developers/quickstart`, `/developers/catalogue-ingestion`, `/developers/sandbox`, `/developers/webhooks` | Missing — Phase 2/3 (reserved) |
| `/company/technology` (Technology Approach) | Missing — Phase 2 |
| `/company/careers` | Missing — Phase 3 |
| API Documentation | External destination — **verified live** (`https://api-docs.resomix.com/`) |
| Support | External destination — **verified live** (`https://support.resomix.com/`) |
| Journal | External destination — **verified live** (`https://resomix.com/blog/`) |
| System Status | Not recommended until a status page exists — requires confirmation |

## 9. Phase 1 set — recalculated

Route consolidation yields **14 pages** (§7). Recommendation: **Option A — focused 14-page launch.** Reasons: (a) no page is added merely to reach 15; (b) every deferred candidate fails a materiality test for the first rollout — Home revision is better shipped immediately after (nav shell already changes in Wave A, full revision deserves its own approved task), Pricing revision needs commercial decisions, Contact Partnerships has a verified interim anchor (`/partners#contact`), Technology Approach and Catalogue Ingestion serve later-stage journeys already covered by `/developers` + the external hub. Option B remains available if the user prefers a 15th page; the strongest candidate would be the Home revision.

In-set adjustments vs the original brief: Discovery API Overview [was P1-5] becomes **Developers Overview** at `/developers` with a broader commercial+technical scope; Music Platforms & Stores + DJ Software & Music Technology merge into **Platforms & Music Technology** [P1-10]; Trust moves to root `/trust`; Partner Overview remains a revision of `/partners`.

## 10. Deferred Phase 2 and Phase 3 pages

**Phase 2:** Home revision; Publishers, Sync Agencies & Music Libraries; Sample Libraries & Providers; Plans & Pricing consolidation; Contact Partnerships; Partner Brief; Technology Approach; Quickstart (`/developers/quickstart`); Catalogue Ingestion (`/developers/catalogue-ingestion`); Sandbox Access page (`/developers/sandbox` — mechanism already live on `/partners` + external hub).
**Phase 3:** Webhooks & Events (`/developers/webhooks`); Developer Support; Careers; System Status (only if real); deeper Journal integration.
**Flagged future decision:** splitting P1-10 into `/solutions/music-platforms` + `/solutions/dj-software-music-technology` once traffic/conversion data justifies two pages. For the first approved rollout the combined route stands.

## 11. Desktop header architecture

```text
RESOMIX   Product ▾   Solutions ▾   Partners ▾   Developers ▾   Company ▾        Sign In   [Try Resomix]
```

**One persistent CTA** (`Try Resomix`); the partner CTA (`Book a Partner Demo` / `Start a Catalogue Pilot`) appears contextually inside the Partners menu and on partner/enterprise pages — never as a second global header pill. "Sign In" replaces the current "Login" label (approval item). Implementation impact unchanged: shared `Navbar` redesign requires consumer inspection (IMPLEMENTATION_RULES §8/§30).

## 12. Mobile navigation architecture

Keep `MobileNavbar` → full-screen `MenuPage` overlay (z-[100]); five collapsible groups (Product, Solutions, Partners, Developers, Company), then Sign In / Profile, then one primary CTA (`Try Resomix`); partner CTA inside the Partners group. `MenuPage` is landing-local. The visual pattern of the menu is decided through `docs/design-lab/` (design-neutral here); the full-screen overlay remains the default until design approval.

## 13. Product menu

| Entry | Route |
|---|---|
| Product Overview | `/product` |
| Sonic Discovery | `/product/sonic-discovery` |
| Track Intelligence | `/product/track-intelligence` |
| Catalogue Intelligence | `/product/catalogue-intelligence` |
| — supporting link: "Discovery API for Platforms" | `/developers` (no second API page) |

Each entry carries a one-line Fira Code descriptor. "Powered by PYXIS-1" appears as attribution under Track Intelligence, never as the label.

## 14. Solutions mega-menu

**Individuals** — DJs (`/solutions/djs`) · Producers (`/solutions/producers`) · Curators & Music Supervisors (`/solutions/curators-music-supervisors`)

**Organisations** — Labels & Distributors (`/solutions/labels-distributors`) · Platforms & Music Technology (`/solutions/platforms-music-technology`)

Deferred audience groups (Publishers/Sync/Libraries, Sample Libraries) appear only when their pages exist. No dead links.

## 15. Partners menu

Partner Overview (`/partners`) · Private Catalogue Pilot (`/partners/pilot`) · Integration Options (`/partners/integrations`) · Trust, Rights & Security (`/trust`) · Contact Partnerships (`/partners#contact` — existing verified form anchor, until a dedicated page is approved).

## 16. Developers menu

Developers Overview (`/developers`) · API Documentation (`https://api-docs.resomix.com/` — **verified live**, external) · Sandbox Access (`/partners#sandbox` on-site mechanism; the external hub also exposes a public sandbox key) · Catalogue Ingestion (Phase 2 — enters the menu only when the page exists) · Developer Support (Phase 2/3 — destination unresolved; `support.resomix.com` is the end-user help centre, not confirmed as developer support).

## 17. Company menu

About Resomix (`/about`) · Technology Approach (Phase 2, when created) · Journal (`https://resomix.com/blog/` — **verified live**, external) · Contact (`/contact`) · Careers (Phase 3, when relevant).

## 18. Utility navigation

Sign In (`{BASE_BETA_URL}/auth/login?redirect=…`) · Support (`https://support.resomix.com/` — verified live; already linked from `GlobalFooter`) · API Docs (verified external) · System Status (absent until it exists). Legal/privacy/policy destinations live in the footer/utility layer (and largely resolve to the verified Help Center legal library).

## 19. Footer architecture

Keep the terminal-identity footer; add a link matrix above the terminal block:

| Column | Entries |
|---|---|
| Product | Overview, Sonic Discovery, Track Intelligence, Catalogue Intelligence |
| Solutions | the 5 Phase 1 audience pages |
| Partners | Overview, Catalogue Pilot, Integrations, Trust |
| Developers | Overview, API Documentation (external), Sandbox |
| Company | About, Journal, Contact |
| Utility | Support, Privacy preferences (Silktide trigger — existing), Legal (Help Center legal library) |

Shared-component impact (`GlobalFooter`/`GlobalMobileFooter`) — approval + consumer inspection required.

## 20. Sign-in and beta navigation

Unchanged, verified: landing login → `${BASE_BETA_URL}/auth/login?redirect=<path>`; authenticated users get `ProfileDropdown` (`showAppLinks={false}` on landing); `Try Resomix` → `BASE_BETA_URL` root.

## 21. Same-app navigation behavior

Client-side via the layout's `handleNavigate`; all new internal links route through `onNavigate`/`LinkButton`. `MenuPage`'s raw `window.location.href` pattern is recorded drift — do not propagate.

## 22. Cross-app navigation behavior

> Navigation between `resomix.com` and `beta.resomix.com` is cross-origin and requires full document navigation, even when handled through a shared navigation helper. Same-app destinations may use client-side routing.

URLs always built from `BASE_LANDING_URL`/`BASE_BETA_URL` (`@resomix/config`).

## 23. External documentation and support behavior

External destination verification (performed 2026-07-22, live checks):

| Destination | Result |
|---|---|
| `https://api-docs.resomix.com/` | **Live** (200). "Resomix Developer Hub — B2B Audio Similarity API". Public sandbox key, quickstart curl (`sandbox.resomix.com/v1/similarity/query`), guides/API reference/playground navigation. JS-rendered SPA. Navigation back to resomix.com **not observed** in page content — minor inconsistency to fix on the hub side (flagged). Safe to expose in navigation. Uses American "catalog" (internal convention — acceptable). |
| `https://support.resomix.com/` | **Live** (200). Help Center with Legal library (Privacy v7.0, ToS v7.0, GDPR Summary, Cookie, AUP, DMCA, Refund, Platform Disclaimer, Open-Source Music & Licensing Transparency — all effective 2026-07-05; operator "Reform Studios", Greece) + FAQ. Safe to expose (already in footer). |
| `https://resomix.com/blog/` | **Live** (200). Ghost-powered "Resomix Sonic Discovery" journal; British "catalogue" usage; has navigation back to resomix.com ("Sonic Discovery" link); partner page `/blog/partners/`. Safe to expose. |

Observed inconsistency to flag (not to fix in this phase): the blog footer states `region: EU (AT/DE)` while the legal documents name a Greek-registered operator (Reform Studios) — the Trust page copy must reconcile with legal before publication (PAGE_BRIEFS P1-14). External links open per existing `LinkButton newTab` convention. Local duplicate pages for these external services must not be built.

## 24. Contextual CTA strategy

| ID | Label | Destination | Type | Status |
|---|---|---|---|---|
| CTA-1 | Try Resomix | `BASE_BETA_URL` | cross-app | Verified |
| CTA-2 | Explore Sonic Discovery | `/product/sonic-discovery` | same-app | Phase 1 |
| CTA-3 | Analyse a Track | `${BASE_BETA_URL}/analysis` | cross-app | Verified (protected; login redirect preserves target) |
| CTA-4 | Book a Partner Demo | unresolved (no scheduling system) | form/external | **Unresolved** — interim `/partners#contact` |
| CTA-5 | Start a Catalogue Pilot | `/partners/pilot` → form | same-app → form | Page Phase 1; end-form interim = existing partner form |
| CTA-6 | Contact Partnerships | `/partners#contact` | form | Verified interim; standalone page Phase 2 |
| CTA-7 | Explore the API | `/developers` | same-app | Phase 1 |
| CTA-8 | View API Documentation | `https://api-docs.resomix.com/` | external | **Verified live** |
| CTA-9 | Request Sandbox Access | `/partners#sandbox` | same-app anchor | Verified (external hub also offers public sandbox key) |

"Upload Your Track" is retired as the universal marketing CTA (webapp/product contexts only; Home hero decision in Phase 2). Enterprise pages use CTA-5/CTA-6 as primary, never CTA-1. British spelling in labels ("Analyse", "Catalogue").

## 25. Proposed route renames

None of the existing production routes are renamed. The revision-2 renames (§0) apply only to previously proposed, never-shipped routes.

## 26. Proposed redirects

- `/api` → `/developers` (301) — Phase 1, requires approval. No `/api` content page is ever built.
- `/subscribe` → `/pricing` (301) on landing — Phase 2, requires approval (webapp `/subscribe` untouched).
- No redirect needed from `/partners/trust` (never shipped); PAGE_BRIEFS and nav reference `/trust` only.

## 27. Pages to remove or de-emphasise

Unchanged: `/waitlist` leaves primary nav (requires product confirmation); `/pricing`-`/subscribe` consolidation Phase 2; Navbar "Journal" link retained (destination now verified); nothing deleted in Phase 1.

## 28. Internal-linking strategy

- Product pages link: sibling products, 2–3 relevant solution pages, conversion CTA. Product pages link to `/developers` where integration intent is plausible (Catalogue Intelligence → Developers, per platform journeys).
- Solution pages link: 1–2 primary product pages, one adjacent solution, CTA.
- Partner pages interlink: Overview ↔ Pilot ↔ Integrations; all link `/trust` and Contact Partnerships (CTA-6).
- `/developers` links commercial context (`/partners/integrations`) and the external hub (CTA-8); `/trust` is linked from all partner pages and `/developers`.
- Footer matrix (§19) is the complete map; in-page links stay curated (≤6).

## 29. Five-second comprehension goals

Unchanged: every hero answers — what this is, who it's for, availability status, one next action — without scrolling. Test phrasing per page in PAGE_BRIEFS.

## 30. User journeys

| Persona | Journey |
|---|---|
| DJ | Home/ad → `/solutions/djs` → `/product/sonic-discovery` → CTA-1 → beta upload |
| Producer | `/solutions/producers` → `/product/track-intelligence` → CTA-3 → beta `/analysis` |
| Curator / music supervisor | `/solutions/curators-music-supervisors` → `/product/sonic-discovery` → CTA-1 |
| Label / distributor | `/solutions/labels-distributors` → `/product/catalogue-intelligence` → `/partners/pilot` → CTA-5 |
| Catalogue manager | `/product/catalogue-intelligence` → `/trust` → `/partners/pilot` → CTA-5 |
| Music-platform buyer | `/solutions/platforms-music-technology` → `/developers` → `/partners/integrations` → CTA-6 |
| DJ-software product manager | `/solutions/platforms-music-technology` → `/developers` → `/partners/integrations` → CTA-6 |
| Developer | `/developers` → CTA-8 API docs (external) / CTA-9 sandbox → `/partners/integrations` |
| Technical evaluator | `/product` → `/developers` → `/trust` → CTA-9/CTA-6 |
| Partner / enterprise buyer | `/partners` → `/partners/pilot` + `/trust` → CTA-5/CTA-4 |

## 31. Conversion journeys

(a) **Self-serve** → beta (CTA-1/CTA-3); entitlement gates upsell at beta `/subscribe`. (b) **Partner/enterprise** → human conversation (CTA-5/CTA-6; interim `/partners#contact`). (c) **Technical** → sandbox + docs without a sales gate (CTA-8/CTA-9), then (b) for commercial terms.

## 32. Navigation acceptance criteria

Unchanged from revision 1 (zero dead links; ≤2 interactions to any solution page; mega-menu + footer coverage; persistent primary CTA; keyboard operable; cross-app links full navigations from `@resomix/config`; current-page indication; 393px mobile menu integrity; both themes; existing routes unchanged) — plus: 11. `/developers` reachable from both the Developers menu and the Product menu supporting link; 12. every external destination in nav is one of the three verified URLs.

## 33. Open route decisions

See "Open decisions" below.

---

## Open decisions

1. **`/api` → `/developers` redirect** — approve adding the redirect route in Phase 1.
2. **Header CTA** — single persistent `Try Resomix` (recommended, as specified); confirm demotion of the partner CTA to contextual placements.
3. **"Sign In" vs current "Login"** label.
4. **CTA-4 Book a Partner Demo destination** — scheduling tool, dedicated form, or keep routing to `/partners#contact`.
5. **Waitlist de-emphasis** — confirm.
6. **`/subscribe` → `/pricing` redirect** (Phase 2).
7. **Future split of P1-10** into `/solutions/music-platforms` + `/solutions/dj-software-music-technology` — flagged for a later data-informed decision; combined page stands for launch.
8. **Developer Support destination** — is `support.resomix.com` intended to serve developers, or will a dedicated channel exist?
9. **api-docs hub lacks visible navigation back to resomix.com** — fix on hub side (outside this repo) or accept.

## Required confirmations

- Product: open-beta status; Track Intelligence availability wording; Catalogue Intelligence pilot scope; screenshot policy.
- Technical: `/api` redirect mechanics; sandbox scope wording (on-site vs external hub); reconciliation of the hub's "50,000+ CC-licensed tracks" claim if referenced in marketing copy.
- Commercial: partner demo mechanism; pilot terms.
- Legal: Trust-page language (PAGE_BRIEFS P1-14), including reconciliation of operator/region statements (Reform Studios/Greece vs blog "EU (AT/DE)").

## Change history

- 2026-07-22 — Revision 2: British public spelling; `/developers` as first-class API overview; `/api` redirect; `/trust` canonical; shorter partner routes; combined Platforms & Music Technology page; 14-page Phase 1 (Option A); external destinations verified live; migration table added. Author: Claude.
- 2026-07-22 — Initial draft proposal. Author: Claude.
