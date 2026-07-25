# Resomix Phase 1 Page Briefs

Status: Draft proposal — awaiting approval (revision 3 — visual direction reset)
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Governs content, structure, claims, CTAs, and acceptance criteria of the 14 Phase 1 pages. Routes/navigation: `docs/WEBSITE_ARCHITECTURE.md`. Visual rules: `docs/DESIGN_SYSTEM.md` (final visual direction pending `docs/design-lab/` approval). Engineering rules: `docs/IMPLEMENTATION_RULES.md`.
Primary sources: webapp UI and capabilities (`apps/webapp/src`), partner surface (`apps/landing/src/pages/PartnersPage.tsx`, `packages/api-client/src/partner.ts`), billing (`packages/ui/src/Billing/*`), brand book (`docs/BRAND_GUIDELINES.pdf`), verified external destinations (api-docs/support/blog, 2026-07-22)
Last reviewed: 2026-07-22

Language convention (revised 2026-07-22): **British English for public marketing copy** — Catalogue, organisation, analyse. Public terminology: **Catalogue**. Internal/code terminology may remain **Catalog** where already established (e.g. webapp "Demo Catalog", API fields, developer-hub copy); no code identifiers are renamed. The live Journal already writes "catalogue" (resomix.com/blog).

These briefs contain **no** fabricated testimonials, customer names, metrics, pricing figures, certifications, or product guarantees. Where evidence is absent, a placeholder + required confirmation is specified instead.

---

## A. Page-priority matrix

| Wave | Pages | Rationale |
|---|---|---|
| A — platform story + nav shell | P1-1 Product Overview, P1-2 Sonic Discovery, P1-11 Partner Overview | Unblocks navigation, states the platform, covers both conversion pools |
| B — product depth + enterprise path | P1-3 Track Intelligence, P1-4 Catalogue Intelligence, P1-5 Developers Overview, P1-12 Catalogue Pilot, P1-14 Trust | Completes product menu and the partner journey |
| C — audience routing | P1-6…P1-10 Solutions pages, P1-13 Integration Options | Converts existing traffic into the right journeys |

## B. Phase 1 list (14 pages, priority order — Option A focused launch)

1. Product Overview — `/product`
2. Sonic Discovery — `/product/sonic-discovery`
3. Track Intelligence — `/product/track-intelligence`
4. Catalogue Intelligence — `/product/catalogue-intelligence`
5. Developers Overview — `/developers`
6. DJs — `/solutions/djs`
7. Producers — `/solutions/producers`
8. Curators & Music Supervisors — `/solutions/curators-music-supervisors`
9. Labels & Distributors — `/solutions/labels-distributors`
10. Platforms & Music Technology — `/solutions/platforms-music-technology`
11. Partner Overview — `/partners` (revision of existing page)
12. Private Catalogue Pilot — `/partners/pilot`
13. Integration Options — `/partners/integrations`
14. Trust, Rights & Security — `/trust`

`/api` is a proposed redirect to `/developers` (no brief; no content page).

## C. Deferred page list

Phase 2: Home revision; Publishers, Sync Agencies & Music Libraries; Sample Libraries & Providers; Plans & Pricing consolidation; Contact Partnerships; Partner Brief; Technology Approach; Quickstart; Catalogue Ingestion; Sandbox Access page. Phase 3: Webhooks & Events; Developer Support; Careers; System Status; deeper Journal integration. Flagged future decision: splitting P1-10 into Music Platforms + DJ Software & Music Technology. (Full classification: WEBSITE_ARCHITECTURE §8/§10.)

## D. Product-truth legend

| Code | Meaning |
|---|---|
| T-LIVE | Live in current beta (verified in webapp UI/flows) |
| T-UI | Visible in current UI but not verified end-to-end (e.g., sample-data views) |
| T-BACKEND | Existing backend capability (API code exists; not necessarily surfaced) |
| T-API | Existing API capability (partner/api-client/developer-hub evidence) |
| T-EXT | Verified live external destination (api-docs / support / blog) |
| T-PARTNER | Partner-only capability |
| T-PILOT | Pilot capability (managed, not self-serve) |
| T-PLANNED | Planned capability — must be labelled as planned if shown |
| T-CONCEPT | Conceptual marketing explanation (no capability claim) |
| C-PRODUCT / C-TECH / C-LEGAL / C-COMM | Requires product / technical / legal / commercial confirmation |
| T-NO | Do not publish as live |

## E. CTA legend

From WEBSITE_ARCHITECTURE §24: CTA-1 Try Resomix (cross-app, verified) · CTA-2 Explore Sonic Discovery · CTA-3 Analyse a Track (cross-app, verified) · CTA-4 Book a Partner Demo (**unresolved**) · CTA-5 Start a Catalogue Pilot (`/partners/pilot` → form) · CTA-6 Contact Partnerships (`/partners#contact`, verified interim) · CTA-7 Explore the API (`/developers`) · CTA-8 View API Documentation (`https://api-docs.resomix.com/`, **verified live**) · CTA-9 Request Sandbox Access (`/partners#sandbox`, verified).

## F. Content-source and approval legend

`[SRC:REPO]` verified in repository · `[SRC:EXT]` verified on a live external Resomix property · `[SRC:BRAND]` brand book · `[SRC:STRATEGIC]` approved messaging direction (qualitative only) · `[SRC:APPROVAL]` may not publish until the named confirmation clears.

Shared brief conventions (apply to all 14 pages): visual treatment follows DESIGN_SYSTEM §28–32; the upgraded visual system is pending `docs/design-lab/` approval; accessibility per IMPLEMENTATION_RULES §28; implementation dependencies always include route + layout-mode registration, nav/mega-menu entry, translation keys, and the Wave A nav redesign; acceptance criteria always include: build passes, a11y passes, both themes, 393/1280/≥1920, zero dead links, claims match truth labels, and the Visual design approval gate (IMPLEMENTATION_RULES §37) is satisfied before implementation.

**Visual system status blocks.** Every brief carries a temporary status block; page-specific visual concepts return only after the design-lab gates are approved (IMPLEMENTATION_RULES §37).

---

## P1-1 — Product Overview

1. **Page name:** Product Overview
2. **Canonical route:** `/product`
3. **Current repository status:** Missing — platform story currently split across Home/About.
4. **Implementation priority:** Wave A (highest).
5. **Primary audience:** All four groups (first-touch platform explainer).
6. **Secondary audiences:** Investors/press.
7. **Visitor awareness:** Problem-aware, mostly Resomix-unaware.
8. **Visitor problem:** "What is this platform and which part matters to me?"
9. **Job to be done:** Understand the three surfaces + API in under a minute and self-route.
10. **Primary page promise:** Resomix turns sound itself into discovery and intelligence — for individuals, catalogues, and platforms. `[SRC:STRATEGIC][T-CONCEPT]`
11. **Supporting message:** From one reference track to scored matches (Sonic Discovery `[T-LIVE]`), to full sonic anatomy (Track Intelligence `[T-UI]`), to catalogue-scale intelligence (Catalogue Intelligence `[T-PILOT][C-PRODUCT]`) and integration (`/developers`, `[T-API]`).
12. **Primary CTA:** CTA-1 Try Resomix.
13. **Secondary CTA:** CTA-6 Contact Partnerships.
14. **Conversion destination:** Webapp upload (self-serve) or partner form (business).
15. **Required section order:** Hero → Platform map (3 surfaces + Developers path) → "How it connects" (signal-path motif) → Per-surface teasers with status labels → Audience router → CTA block.
16. **Purpose of every section:** Hero states the promise; map kills the "upload tool only" misread; connect shows one engine feeding three surfaces; teasers hand off to product pages; router hands off to solutions; CTA converts both pools.
17. **Questions every section must answer:** What is Resomix? What are the parts? How do they relate? What does each do for me and is it live? Where do I go? What now?
18. **Recommended evidence:** Real beta screenshots (upload + scored playlist) `[SRC:REPO]`; status labels `[SRC:REPO]`.
19. **Recommended screenshot/diagram:** Platform diagram — reference track → PYXIS-1 → three outputs; "Powered by PYXIS-1" attribution style `[SRC:REPO]`.
20. **Visual treatment:** DESIGN_SYSTEM §29; signal-path motif direction pending design-lab; one Benzin display fragment max.
21. **Desktop hierarchy:** Full-viewport hero; platform map as three dotted panels + developers rail; router band.
22. **Mobile hierarchy:** Stacked map; router as accordion links.
23. **Current-capability boundaries:** Sonic Discovery live in beta `[T-LIVE]`; Track Intelligence sample-data phase `[T-UI][C-PRODUCT]`; Catalogue Intelligence pilot `[T-PILOT]`; API partner-scoped with public sandbox `[T-API][T-EXT]`.
24. **Claims to avoid:** Catalogue-size numbers; accuracy/speed guarantees; presenting the API as unrestricted public self-serve.
25. **Product confirmations:** Surface naming; Track Intelligence positioning; open-beta status.
26. **Technical confirmations:** None beyond screenshot approval.
27. **Legal/commercial confirmations:** None.
28. **Internal links:** 3 product pages, `/developers`, 2–3 top solutions, `/partners`.
29. **Related pages:** All P1 pages (hub).
30. **SEO title:** "Resomix — Sonic Discovery, Track Intelligence & Catalogue Intelligence Platform"
31. **Meta description:** "Resomix turns sound into discovery and intelligence. Find tracks from a reference sound, understand any track's sonic anatomy, and connect catalogue audio to modern discovery."
32. **OG direction:** Dark platform-map card, main logotype, orange accent node `[SRC:BRAND]`.
33. **FAQ/GEO:** "What is Resomix?"; "What is PYXIS-1?" (one-line attribution answer).
34. **Accessibility notes:** Platform diagram needs a text alternative naming the three surfaces + API path.
35. **Implementation dependencies:** Shared (§F); first page requiring the new nav.
36. **Acceptance criteria:** Shared (§F) + 5-second test: first-time visitor can name the three surfaces after hero + map.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-2 — Sonic Discovery

1. **Page name:** Sonic Discovery
2. **Canonical route:** `/product/sonic-discovery`
3. **Current repository status:** Missing as a marketing page; capability live in webapp (upload/search/demo catalogue → scored results, depth selector, chain discovery, waveform previews) `[SRC:REPO]`.
4. **Implementation priority:** Wave A.
5. **Primary audience:** DJs; curators/music supervisors.
6. **Secondary audiences:** Producers; platform evaluators.
7. **Visitor awareness:** Solution-aware.
8. **Visitor problem:** Crate digging by metadata and popularity misses what actually sounds right.
9. **Job to be done:** See that a reference sound becomes a scored, listenable shortlist — then try it.
10. **Primary page promise:** Start from a sound, not a search box: drop a reference track and get scored matches by sonic similarity. `[T-LIVE]`
11. **Supporting message:** Reduce hours of crate digging to a focused shortlist `[SRC:STRATEGIC]`; discovery through groove, energy, timbre, and structure `[SRC:STRATEGIC][T-CONCEPT]`; chain discovery `[T-LIVE]`.
12. **Primary CTA:** CTA-1 Try Resomix.
13. **Secondary CTA:** CTA-3 Analyse a Track.
14. **Conversion destination:** Webapp upload page.
15. **Required section order:** Hero → How it works (3 steps) → Results anatomy (annotated playlist capture) → Depth & chain discovery → Boundaries/availability → Audience links → CTA block.
16. **Section purposes:** Outcome → demystify → prove with real UI → differentiate → trust → route → convert.
17. **Questions answered:** What do I give it? What do I get back? How is it scored (attribution-level: "scored by PYXIS-1")? Can I dig deeper? What's free vs limited (link plans, no figures)? Is it live (yes, beta)?
18. **Recommended evidence:** Upload panel, scored playlist with waveforms, depth selector `[SRC:REPO]`; honest beta banner language `[SRC:REPO]`.
19. **Screenshot/diagram:** Annotated results table (score, waveform preview, chain-discover action).
20. **Visual treatment:** §29; waveform/connection motif tied to the actual result set.
21. **Desktop hierarchy:** Hero with product visual; steps as horizontal Fira protocol; anatomy full-width.
22. **Mobile hierarchy:** Steps stack; mobile capture (`PlaylistMobile` exists `[SRC:REPO]`).
23. **Current-capability boundaries:** Live in beta `[T-LIVE]`; demo catalogue + user uploads; search restricted in demo mode `[SRC:REPO]`; entitlement limits `[T-LIVE]`; catalogue breadth not quantified `[C-PRODUCT]`.
24. **Claims to avoid:** Match-accuracy percentages; catalogue-size numbers; speed guarantees; streaming-service claims.
25. **Product confirmations:** Publicly showable result-table features; demo-catalogue wording.
26. **Technical confirmations:** None.
27. **Legal/commercial confirmations:** None.
28. **Internal links:** `/product/track-intelligence`, `/product`, `/solutions/djs`, `/solutions/curators-music-supervisors`.
29. **Related pages:** DJs, Curators, Producers.
30. **SEO title:** "Sonic Discovery — Find Tracks by Sound, Not Tags | Resomix"
31. **Meta description:** "Drop a reference track and get scored matches by sonic similarity — groove, energy, timbre, and structure. Sonic Discovery is live in the Resomix beta."
32. **OG direction:** Waveform-to-nodes motif card.
33. **FAQ/GEO:** "How do I find songs that sound similar to a track?"
34. **Accessibility:** Annotation callouts exist as text; audio visuals get alt text.
35. **Dependencies:** Shared (§F); screenshot production.
36. **Acceptance criteria:** Shared (§F) + every capability statement maps to a verified `[T-LIVE]` feature.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-3 — Track Intelligence

1. **Page name:** Track Intelligence
2. **Canonical route:** `/product/track-intelligence`
3. **Current repository status:** Missing as marketing page. Product surface at webapp `/analysis` (protected): stat cards, structure timeline, waveform+beat grid, energy journey, spectrogram, Camelot wheel, chromagram, timbre, genre/mood/instrument evolution, stems composition, mood radar. **Currently renders a hardcoded sample analysis** (`useTrackAnalysis.ts`); analysis API functions exist (`packages/api-client/src/analysis.ts`). `[SRC:REPO]`
4. **Implementation priority:** Wave B.
5. **Primary audience:** Producers; DJs preparing sets.
6. **Secondary audiences:** Curators; technical evaluators.
7. **Visitor awareness:** Problem-aware.
8. **Visitor problem:** Hearing that a track "works" without seeing why — key, structure, energy, timbre.
9. **Job to be done:** See the depth of per-track analysis and try it.
10. **Primary page promise:** Understand the sonic DNA of any reference track — structure, energy, harmony, timbre, and mood in one view. `[SRC:STRATEGIC]` availability honestly labelled `[T-UI][C-PRODUCT]`.
11. **Supporting message:** Powered by PYXIS-1 `[SRC:REPO]`; measured (tempo·key·loudness) vs predicted (genre·mood·instruments) — the product's own honest framing `[SRC:REPO]`.
12. **Primary CTA:** CTA-3 Analyse a Track.
13. **Secondary CTA:** CTA-2 Explore Sonic Discovery.
14. **Conversion destination:** Webapp `/analysis` (login-gated; redirect preserved).
15. **Required section order:** Hero → What you see (dashboard tour) → Measured vs predicted → From understanding to discovery (bridge) → Boundaries/availability → CTA block.
16. **Section purposes:** Promise → proof → technical trust → cross-sell → honesty → convert.
17. **Questions answered:** What does it analyse? Measured vs modelled? What do I provide? Is it available (per confirmed wording)? How does it connect to discovery?
18. **Recommended evidence:** Dashboard captures with explicit "sample analysis" caption until live wiring confirmed `[SRC:REPO][C-PRODUCT]`.
19. **Screenshot/diagram:** Annotated dashboard; measured-vs-predicted split diagram.
20. **Visual treatment:** §29; spectral/structural motif; the dashboard is the visual.
21. **Desktop hierarchy:** Hero + capture; alternating tour rows.
22. **Mobile hierarchy:** Stacked; cropped mobile-legible slices.
23. **Current-capability boundaries:** UI live to beta users, data sample `[T-UI]`; upload-for-analysis simulated `[T-UI]`; API endpoints exist `[T-BACKEND]`; **no general-availability claim without confirmation** `[C-PRODUCT]`.
24. **Claims to avoid:** Predicted-feature accuracy; "instant" analysis; stems quality; sample data as real results.
25. **Product confirmations:** Availability wording; upload-analysis enablement; screenshots.
26. **Technical confirmations:** Live-wiring status.
27. **Legal/commercial confirmations:** None.
28. **Internal links:** `/product/sonic-discovery`, `/product`, `/solutions/producers`, `/solutions/djs`.
29. **Related pages:** Producers, DJs.
30. **SEO title:** "Track Intelligence — See What a Track Is Made Of | Resomix"
31. **Meta description:** "Structure, energy, harmony, timbre, and mood — Track Intelligence, powered by PYXIS-1, turns any reference track into a readable sonic anatomy."
32. **OG direction:** Spectral/structure motif card.
33. **FAQ/GEO:** "How do I find the key and BPM of a song?" (feature-level answer).
34. **Accessibility:** Tour not colour-only; each panel described in text.
35. **Dependencies:** Shared (§F); gated on 25/26.
36. **Acceptance criteria:** Shared (§F) + availability labels match confirmed status; no unlabelled sample data.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-4 — Catalogue Intelligence

1. **Page name:** Catalogue Intelligence
2. **Canonical route:** `/product/catalogue-intelligence`
3. **Current repository status:** Missing. Supporting evidence: partner API (`partner.ts`), ingestion API (`admin/ingestion`), demo-catalogue behaviour, `DEMO_MODE` redaction, library artifact chips `[SRC:REPO]`; developer hub "catalog mapping" for archives `[SRC:EXT]`. No self-serve catalogue product exists.
4. **Implementation priority:** Wave B.
5. **Primary audience:** Labels, distributors, catalogue owners/managers.
6. **Secondary audiences:** Publishers, sync agencies, music libraries (Phase 2 pages).
7. **Visitor awareness:** Problem-aware ("our back catalogue is invisible").
8. **Visitor problem:** Catalogue value locked behind stale metadata; relationships, clusters, and overlooked recordings invisible.
9. **Job to be done:** Understand what Resomix could reveal inside their catalogue and how to start (pilot).
10. **Primary page promise:** Turn catalogue audio into searchable sonic intelligence — surface relationships that metadata alone does not reveal. `[SRC:STRATEGIC][T-CONCEPT]`, delivery framed strictly as a managed pilot `[T-PILOT][C-PRODUCT]`.
11. **Supporting message:** Identify relationships, clusters, opportunities, and overlooked recordings `[SRC:STRATEGIC]`; built on the same engine as the live beta `[SRC:REPO]`.
12. **Primary CTA:** CTA-5 Start a Catalogue Pilot.
13. **Secondary CTA:** CTA-6 Contact Partnerships.
14. **Conversion destination:** `/partners/pilot` → partner form.
15. **Required section order:** Hero → The metadata gap → What sonic intelligence adds (concept-labelled) → How a pilot works (bridge to P1-12) → Trust posture (link `/trust`) → CTA block.
16. **Section purposes:** Problem resonance → capability vision → concrete next step → risk reduction → conversion.
17. **Questions answered:** What does it do to my catalogue? Is my catalogue exposed publicly (confirmed trust language only, else placeholder `[C-LEGAL]`)? Is this live (no — pilot)? What does starting involve (pilot framing, no prices)?
18. **Recommended evidence:** Redaction mechanism as qualitative evidence `[SRC:REPO]`; pilot-process diagram; **no customer names**.
19. **Screenshot/diagram:** Catalogue-as-constellation motif; pilot-flow diagram.
20. **Visual treatment:** §31; orbital/cluster motif dominant; restrained.
21. **Desktop hierarchy:** Statement-led hero; problem/capability paired columns; protocol-style pilot summary.
22. **Mobile hierarchy:** Columns stack; numbered protocol list.
23. **Current-capability boundaries:** Pilot/partner-scoped only `[T-PILOT][T-PARTNER]`; ingestion mechanics internal `[T-BACKEND]`; operational claims gated `[C-PRODUCT]`.
24. **Claims to avoid:** Revenue promises; size/throughput numbers; reactivation guarantees; DDEX/format claims `[C-TECH]`; confidentiality guarantees `[C-LEGAL]`.
25. **Product confirmations:** Pilot scope/deliverables; naming.
26. **Technical confirmations:** Ingestion formats/methods before any is named.
27. **Legal/commercial confirmations:** Confidentiality/rights statements; pilot terms.
28. **Internal links:** `/partners/pilot`, `/trust`, `/developers`, `/solutions/labels-distributors`.
29. **Related pages:** Labels & Distributors, Partner Overview, Pilot, Trust.
30. **SEO title:** "Catalogue Intelligence — Sonic Intelligence for Music Catalogues | Resomix"
31. **Meta description:** "Reveal the relationships, clusters, and overlooked recordings inside your catalogue. Catalogue Intelligence turns catalogue audio into searchable sonic intelligence — starting with a private pilot."
32. **OG direction:** Constellation-motif card.
33. **FAQ/GEO:** "How can labels make back catalogue discoverable?"
34. **Accessibility:** Constellation graphics summarised in text.
35. **Dependencies:** Shared (§F); depends on P1-12/P1-14 for linked language.
36. **Acceptance criteria:** Shared (§F) + zero unconfirmed operational claims; pilot framing consistent with P1-12.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

## P1-5 — Developers Overview

1. **Page name:** Developers Overview
2. **Canonical route:** `/developers` (`/api` proposed redirect here; reserved later routes: `/developers/quickstart`, `/developers/catalogue-ingestion`, `/developers/sandbox`, `/developers/webhooks`)
3. **Current repository status:** Missing as a page. Strong verified substrate: on-site partner sandbox + registration (`PartnersPage.tsx`, `usePartners`) `[SRC:REPO]`; **live external Developer Hub** (`api-docs.resomix.com` — public sandbox key `rmx_sandbox_demo`, quickstart curl to `sandbox.resomix.com/v1/similarity/query`, ingestion-similarity / catalog-mapping / metadata-audit sections, endpoint explorer) `[SRC:EXT][T-EXT]`; api-client surface (similarity, analysis, search, ingestion) `[SRC:REPO]`.
4. **Implementation priority:** Wave B.
5. **Primary audience:** Developers; product managers; technical evaluators; integration teams; platform buyers.
6. **Secondary audiences:** Partnership teams (commercial context).
7. **Visitor awareness:** Solution-aware; build-vs-buy evaluation.
8. **Visitor problem:** Building sonic analysis/similarity in-house is a research project; buying needs a credible, testable API with a clear commercial path.
9. **Job to be done:** Understand what can be built (Discovery API, analysis, similarity), verify seriousness in minutes (docs + sandbox), and route to integration/commercial conversations.
10. **Primary page promise:** Build discovery through sound into your own product — the engine behind the Resomix beta, exposed as an API you can try today. `[T-API][T-EXT]`
11. **Supporting message:** Real-time similarity, catalogue matching, deep tag-metadata extraction (hub's own capability areas `[SRC:EXT]`); working public sandbox `[T-EXT]`; integration options and catalogue ingestion scoped with the team `[T-PILOT][C-TECH]`; API documentation live `[T-EXT]`; developer support channel `[C-TECH]` (unresolved — do not promise SLAs).
12. **Primary CTA:** CTA-8 View API Documentation (external, verified).
13. **Secondary CTA:** CTA-9 Request Sandbox Access (on-site path) — hero shows both; CTA-6 appears in the commercial section.
14. **Conversion destination:** External hub (docs/sandbox) + partner form for commercial scope.
15. **Required section order:** Hero → What you can build (3–4 scenarios) → API surface overview (capability areas from verified sources only) → Quickstart teaser (mirrors hub quickstart; links out — no duplicated docs) → Integration options summary (link `/partners/integrations`) → Catalogue ingestion note (Phase 2 page; qualitative) → Trust link → CTA block.
16. **Section purposes:** Promise → concreteness → breadth honestly → proof-in-minutes → commercial path → enterprise reassurance → convert.
17. **Questions answered:** What can I build? What does the API cover? Can I try it now (yes — docs + sandbox)? Is it public self-serve (sandbox yes; production partner-scoped `[C-COMM]`)? Where are docs (verified external)? Who do I talk to about scale/licensing?
18. **Recommended evidence:** Hub quickstart/curl as screenshot or styled code block quoting the real sandbox call `[SRC:EXT]`; on-site sandbox UI `[SRC:REPO]`.
19. **Screenshot/diagram:** Signal-to-endpoint flow diagram: audio in → PYXIS-1 analysis → endpoints (similarity/search/metadata) → partner app.
20. **Visual treatment:** §32 developer pattern; terminal/code aesthetic; Fira Code dominant.
21. **Desktop hierarchy:** Hero + live code block side-by-side; scenario panels; capability areas as dotted table.
22. **Mobile hierarchy:** Code blocks horizontally scrollable; panels stack.
23. **Current-capability boundaries:** Sandbox + docs verified `[T-EXT]`; production scope partner-negotiated `[T-PARTNER][C-COMM]`; no uptime/SLA/latency statements `[T-NO]`; webhooks not verified `[T-NO]` (Phase 3 page); the hub's "50,000+ CC-licensed tracks" figure may be cited **only** as the hub's sandbox-catalogue description with source attribution `[SRC:EXT][C-PRODUCT]`.
24. **Claims to avoid:** SLAs; latency/scale numbers; unrestricted production self-serve; webhook/event claims; endpoint contracts beyond hub/UI evidence.
25. **Product confirmations:** Which capability areas are publicly listable; sandbox-catalogue description reuse.
26. **Technical confirmations:** Hub↔site navigation fix (hub lacks a visible link back to resomix.com); developer-support channel; `/api` redirect.
27. **Legal/commercial confirmations:** Production licensing framing `[C-COMM]`.
28. **Internal links:** `/partners/integrations`, `/partners#sandbox`, `/product/catalogue-intelligence`, `/trust`, `/product`.
29. **Related pages:** Integration Options, Platforms & Music Technology, Catalogue Intelligence.
30. **SEO title:** "Resomix for Developers — Audio Similarity & Sonic Analysis API"
31. **Meta description:** "Integrate real-time audio similarity, catalogue matching, and deep sonic metadata into your product. Live documentation and a public sandbox — start in minutes, scale with a partner plan."
32. **OG direction:** Code-styled dark card, Fira Code, signal-to-endpoint motif.
33. **FAQ/GEO:** "Is there an API for music similarity?"; "How do I integrate audio similarity search?"
34. **Accessibility:** `<pre>/<code>` semantics; readable contrast for code.
35. **Dependencies:** Shared (§F); §26 confirmations; external-link handling per WEBSITE_ARCHITECTURE §23.
36. **Acceptance criteria:** Shared (§F) + every capability area maps to hub or api-client evidence; no invented endpoints; `/developers` is the only API overview page.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-6 — DJs

1. **Page name:** DJs
2. **Canonical route:** `/solutions/djs`
3. **Current repository status:** Missing. Evidence: live upload→scored playlist flow, "DJ_MODE_ACTIVE" terminal flavour `[SRC:REPO]`; brand mockup slogan "A discovery engine for DJs who feel the music" `[SRC:BRAND]`; blog post "Introducing Resomix — A Discovery Engine For DJs Who Feel The Music" `[SRC:EXT]`.
4. **Implementation priority:** Wave C.
5. **Primary audience:** Working DJs.
6. **Secondary audiences:** DJ-software companies (routed to P1-10).
7. **Visitor awareness:** Problem-aware, product-unaware.
8. **Visitor problem:** Set preparation burns hours of crate digging; tags surface the same obvious tracks.
9. **Job to be done:** See that a reference track becomes a set-ready shortlist; try it on tonight's opener.
10. **Primary page promise:** From one reference track to a set-ready shortlist — matched by sound, not popularity. `[T-LIVE][SRC:STRATEGIC]`
11. **Supporting message:** Groove/energy/timbre matching `[SRC:STRATEGIC]`; chain discovery `[T-LIVE]`; waveform previews `[T-LIVE]`.
12. **Primary CTA:** CTA-1 Try Resomix.
13. **Secondary CTA:** CTA-2 Explore Sonic Discovery.
14. **Conversion destination:** Webapp upload.
15. **Required section order:** Hero → The crate-digging problem → Workflow (reference → matches → preview → build) → Deep-dig features → Bridge to Track Intelligence → CTA block.
16. **Section purposes:** Recognition → empathy → workflow → differentiation → cross-sell → conversion.
17. **Questions answered:** How does this fit set prep? What do I hear before committing? Does it only work with hits (demo catalogue + uploads; no size claims)? What does it cost (link plans, no figures)?
18. **Recommended evidence:** Playlist capture in DJ framing `[SRC:REPO]`.
19. **Screenshot/diagram:** Workflow strip: reference waveform → scored matches.
20. **Visual treatment:** §30; rawest tone of the audience set.
21. **Desktop hierarchy:** Hero statement + proof; horizontal protocol.
22. **Mobile hierarchy:** Vertical workflow.
23. **Current-capability boundaries:** All shown = live beta `[T-LIVE]`; no library-sync/CDJ claims `[T-NO]`.
24. **Claims to avoid:** "Works with Rekordbox/Serato" `[T-NO]`; BPM/key accuracy; offline claims.
25. **Product confirmations:** Screenshot policy only.
26. **Technical confirmations:** None.
27. **Legal/commercial confirmations:** None.
28. **Internal links:** `/product/sonic-discovery`, `/product/track-intelligence`, `/solutions/producers`.
29. **Related pages:** Sonic Discovery, Track Intelligence.
30. **SEO title:** "Resomix for DJs — Find Your Next Track by Sound"
31. **Meta description:** "Drop a reference track and get a scored, listenable shortlist matched on groove, energy, and timbre. Built for DJs who dig deeper than genre tags."
32. **OG direction:** Waveform-forward dark card.
33. **FAQ/GEO:** "How do DJs find similar tracks?"
34. **Accessibility:** Preview/waveform imagery described in text.
35. **Dependencies:** Shared (§F).
36. **Acceptance criteria:** Shared (§F) + all capability statements `[T-LIVE]`.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-7 — Producers

1. **Page name:** Producers
2. **Canonical route:** `/solutions/producers`
3. **Current repository status:** Missing. Evidence: analysis dashboard `[T-UI]`, similarity `[T-LIVE]` `[SRC:REPO]`.
4. **Implementation priority:** Wave C.
5. **Primary audience:** Producers and beatmakers.
6. **Secondary audiences:** Sample-library providers (Phase 2).
7. **Visitor awareness:** Problem-aware.
8. **Visitor problem:** Decoding *why* a reference works (arrangement, energy curve, timbre) is manual and imprecise.
9. **Job to be done:** Use analysis to decode references; use similarity to explore the neighbourhood of a work-in-progress.
10. **Primary page promise:** Decode the reference. Understand the anatomy of the tracks you're chasing — then explore what lives around your own sound. `[SRC:STRATEGIC]`
11. **Supporting message:** Structure/energy/timbre views `[T-UI][C-PRODUCT]`; measured-vs-predicted honesty `[SRC:REPO]`; similarity as feedback on a bounce `[T-LIVE]`.
12. **Primary CTA:** CTA-3 Analyse a Track.
13. **Secondary CTA:** CTA-2 Explore Sonic Discovery.
14. **Conversion destination:** Webapp `/analysis`.
15. **Required section order:** Hero → Decode the reference (producer-framed tour) → Explore the neighbourhood → Workflow fit → Boundaries → CTA block.
16. **Section purposes:** Promise → proof → second use-case → practicality → honesty → conversion.
17. **Questions answered:** What does analysis show about a reference? Can I run my own unreleased track (per P1-3 confirmation)? Does it replace my ears (no — instrument, not oracle)?
18. **Recommended evidence:** Structure timeline, energy journey, stems composition captures (sample-data caption rule) `[C-PRODUCT]`.
19. **Screenshot/diagram:** Structure/energy annotated capture.
20. **Visual treatment:** §30; spectral/structural motif.
21. **Desktop hierarchy:** Alternating tour rows; two use-case blocks.
22. **Mobile hierarchy:** Stacked; cropped slices.
23. **Current-capability boundaries:** Analysis per P1-3 status `[T-UI][C-PRODUCT]`; similarity `[T-LIVE]`; no DAW plugin `[T-NO]`.
24. **Claims to avoid:** DAW/plugin integration; mixing advice claims; genre-accuracy.
25. **Product confirmations:** As P1-3.
26. **Technical confirmations:** Inherits P1-3.
27. **Legal/commercial confirmations:** None.
28. **Internal links:** `/product/track-intelligence`, `/product/sonic-discovery`, `/solutions/djs`.
29. **Related pages:** Track Intelligence, Sonic Discovery.
30. **SEO title:** "Resomix for Producers — Decode Your Reference Tracks"
31. **Meta description:** "See the structure, energy, harmony, and timbre inside your reference tracks — and explore the sonic neighbourhood around your own productions."
32. **OG direction:** Structure-timeline motif card.
33. **FAQ/GEO:** "How do I analyse a reference track?"
34. **Accessibility:** Dashboard slices with text equivalents.
35. **Dependencies:** Shared (§F); gated on P1-3 confirmations.
36. **Acceptance criteria:** Shared (§F) + availability labels match P1-3.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-8 — Curators & Music Supervisors

1. **Page name:** Curators & Music Supervisors
2. **Canonical route:** `/solutions/curators-music-supervisors`
3. **Current repository status:** Missing. Evidence: search + demo catalogue + similarity, favourites/library, shareable playlists (`PlaylistShare`) `[SRC:REPO]`; blog post "Resomix for Music Supervisors and Curators" `[SRC:EXT]`.
4. **Implementation priority:** Wave C.
5. **Primary audience:** Playlist curators; music supervisors (film/TV/ads/games).
6. **Secondary audiences:** Sync agencies; music libraries (Phase 2).
7. **Visitor awareness:** Problem-aware.
8. **Visitor problem:** Briefs are sonic ("like this, but…") while tools search by metadata and popularity.
9. **Job to be done:** Turn a brief's reference track into a shortlist; save and share the result.
10. **Primary page promise:** Answer sonic briefs with sonic search — from reference to shortlist to a shareable playlist. `[T-LIVE][SRC:STRATEGIC]`
11. **Supporting message:** Surface relationships metadata doesn't reveal `[SRC:STRATEGIC]`; library + favourites `[T-LIVE]`; share links `[T-LIVE]`.
12. **Primary CTA:** CTA-1 Try Resomix.
13. **Secondary CTA:** CTA-6 Contact Partnerships (catalogue-side evaluation intent).
14. **Conversion destination:** Webapp upload/search.
15. **Required section order:** Hero → The brief problem → Workflow (reference → matches → curate → share) → For teams and catalogues (bridge to Catalogue Intelligence) → Boundaries → CTA block.
16. **Section purposes:** Recognition → workflow proof → collaboration answer → enterprise bridge → honesty → conversion.
17. **Questions answered:** Search by a reference sound (yes)? Keep/share results (yes)? Is clearance handled (no — explicitly out of scope `[T-NO]`)? Whose catalogue am I searching (wording per P1-2 confirmation)?
18. **Recommended evidence:** Share/library captures `[SRC:REPO]`.
19. **Screenshot/diagram:** Brief-to-playlist workflow strip.
20. **Visual treatment:** §30; editorial calm; connection motif.
21. **Desktop hierarchy:** Workflow-led; lighter terminal styling.
22. **Mobile hierarchy:** Stacked workflow.
23. **Current-capability boundaries:** Flows live `[T-LIVE]`; no rights/clearance features `[T-NO]`; no team seats `[T-NO]`.
24. **Claims to avoid:** Clearance/licensing support; catalogue completeness; "exact cleared alternative" promises.
25. **Product confirmations:** Demo-catalogue wording (shared with P1-2).
26. **Technical confirmations:** None.
27. **Legal/commercial confirmations:** None (clearance claims avoided).
28. **Internal links:** `/product/sonic-discovery`, `/product/catalogue-intelligence`, `/solutions/labels-distributors`.
29. **Related pages:** Sonic Discovery, Catalogue Intelligence.
30. **SEO title:** "Resomix for Curators & Music Supervisors — Search by Sound"
31. **Meta description:** "Turn a reference track into a shortlist. Resomix matches on groove, energy, and timbre so curators and supervisors can answer sonic briefs with sonic search."
32. **OG direction:** Connection-motif card, editorial tone.
33. **FAQ/GEO:** "How do music supervisors find similar songs?"
34. **Accessibility:** Standard (§F).
35. **Dependencies:** Shared (§F).
36. **Acceptance criteria:** Shared (§F) + zero rights/clearance implications.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-9 — Labels & Distributors

1. **Page name:** Labels & Distributors
2. **Canonical route:** `/solutions/labels-distributors`
3. **Current repository status:** Missing. Evidence base: partner surface + pilot framing (P1-4/P1-12) `[SRC:REPO]`; blog post "Beyond Tags and Metadata: Better Music Discovery for Record Labels" `[SRC:EXT]`.
4. **Implementation priority:** Wave C (first business audience page).
5. **Primary audience:** Labels; distributors; catalogue managers.
6. **Secondary audiences:** Publishers (Phase 2); catalogue investors.
7. **Visitor awareness:** Problem-aware, sceptical.
8. **Visitor problem:** Frontline gets the attention; back catalogue sits dark; metadata cleanup alone doesn't create discovery.
9. **Job to be done:** Evaluate whether sonic intelligence can activate their catalogue; start a low-risk pilot conversation.
10. **Primary page promise:** Help catalogue teams connect and reactivate music — see what your catalogue looks like as sonic intelligence. `[SRC:STRATEGIC][T-CONCEPT]`
11. **Supporting message:** Relationships/clusters/overlooked recordings `[SRC:STRATEGIC]`; private pilot entry path `[T-PILOT]`; trust posture linked `[C-LEGAL]`.
12. **Primary CTA:** CTA-5 Start a Catalogue Pilot.
13. **Secondary CTA:** CTA-4 Book a Partner Demo (only if resolved; otherwise CTA-6).
14. **Conversion destination:** `/partners/pilot` → partner form.
15. **Required section order:** Hero → The dark-catalogue problem → What intelligence changes (concept-labelled) → Pilot path summary → Trust summary (link `/trust`) → CTA block.
16. **Section purposes:** Empathy → vision → concrete path → risk reduction → conversion.
17. **Questions answered:** What would we learn? Who sees our audio (`[C-LEGAL]` placeholder until confirmed)? What does a pilot involve? Do we migrate anything (no format claims `[C-TECH]`)?
18. **Recommended evidence:** Pilot-process diagram; cluster motif; **no invented case studies**.
19. **Screenshot/diagram:** Dormant-to-visible cluster schematic (unlabelled axes).
20. **Visual treatment:** §31; most restrained business page.
21. **Desktop hierarchy:** Statement-led hero; problem/outcome columns; protocol summary.
22. **Mobile hierarchy:** Columns stack.
23. **Current-capability boundaries:** Catalogue-side work pilot/partner-scoped `[T-PILOT][T-PARTNER]`; outcomes conceptual `[T-CONCEPT]`.
24. **Claims to avoid:** Revenue uplift; streaming-performance claims; DDEX/delivery support `[C-TECH]`; confidentiality guarantees `[C-LEGAL]`; named customers.
25. **Product confirmations:** Pilot deliverables (inherits P1-12).
26. **Technical confirmations:** Ingestion formats (inherits P1-12).
27. **Legal/commercial confirmations:** Trust language (inherits P1-14); pilot terms `[C-COMM]`.
28. **Internal links:** `/product/catalogue-intelligence`, `/partners/pilot`, `/trust`, `/partners`.
29. **Related pages:** Catalogue Intelligence, Pilot, Trust, Partner Overview.
30. **SEO title:** "Resomix for Labels & Distributors — Activate Your Catalogue"
31. **Meta description:** "Your back catalogue holds relationships metadata can't see. Resomix turns catalogue audio into sonic intelligence — starting with a private, low-risk pilot."
32. **OG direction:** Cluster-motif enterprise card.
33. **FAQ/GEO:** "How can a label make its back catalogue discoverable?"
34. **Accessibility:** Schematics summarised in text.
35. **Dependencies:** Shared (§F); gated on P1-12/P1-14 confirmations for linked language.
36. **Acceptance criteria:** Shared (§F) + all outcome language `[T-CONCEPT]`-framed.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-10 — Platforms & Music Technology

1. **Page name:** Platforms & Music Technology (combined launch page)
2. **Canonical route:** `/solutions/platforms-music-technology` — covers music platforms, digital stores/marketplaces, DJ software, music software, product teams, technical product buyers, embedded discovery/analysis use cases. **Flagged future decision:** split into `/solutions/music-platforms` + `/solutions/dj-software-music-technology` when justified; combined route stands for the first rollout.
3. **Current repository status:** Missing. Evidence: live beta as engine proof `[T-LIVE]`; Developer Hub `[T-EXT]`; partner API/sandbox `[T-API]` `[SRC:REPO][SRC:EXT]`.
4. **Implementation priority:** Wave C.
5. **Primary audience:** Product/engineering leaders at platforms, stores, marketplaces, DJ/music software companies.
6. **Secondary audiences:** Developers (routed to `/developers`); partnership teams.
7. **Visitor awareness:** Solution-aware; build-vs-buy; competitive-feature-driven.
8. **Visitor problem:** Users expect "more like this" discovery inside the product; audio-based similarity in-house is a research programme; metadata recommendations plateau.
9. **Job to be done:** See what embedded sonic discovery/analysis could look like in *their* product; assess engine credibility; route to `/developers` and a commercial conversation.
10. **Primary page promise:** Give your users discovery through sound — embed the engine behind Resomix into your platform or product. `[SRC:STRATEGIC]` via partner API `[T-API]`.
11. **Supporting message:** Live consumer proof (the beta) `[T-LIVE]`; docs + sandbox in minutes `[T-EXT]`; integration models scoped per partnership (link P1-13) `[C-TECH]`; DJ-native workflow evidence for DJ-software buyers `[T-LIVE]`.
12. **Primary CTA:** CTA-6 Contact Partnerships.
13. **Secondary CTA:** CTA-7 Explore the API.
14. **Conversion destination:** Partner form; `/developers`.
15. **Required section order:** Hero → The discovery plateau → What integration adds (user-facing scenarios: "more like this", sonic search, prep-assistant — clearly schematic `[T-CONCEPT]`) → Engine credibility (beta evidence) → Paths by team type (platform / DJ-software rails) → Integration models summary (link `/partners/integrations`) → CTA block.
16. **Section purposes:** Business promise → problem → concrete scenarios → trust via live product → audience self-selection inside the combined page → path → conversion.
17. **Questions answered:** What would our users get? Is the engine real (yes — beta + public sandbox)? How would we integrate (models on P1-13)? Are there existing integrations (none named `[T-NO]`)? Where do engineers start (`/developers`)?
18. **Recommended evidence:** Beta captures as engine proof `[SRC:REPO]`; schematic embed panels labelled as concepts `[T-CONCEPT]`; hub reference `[SRC:EXT]`.
19. **Screenshot/diagram:** Platform-embed schematic: partner UI panel ← Resomix-powered suggestion rail.
20. **Visual treatment:** §31/§32 hybrid; outline-style schematic panels signal concept status.
21. **Desktop hierarchy:** Scenario panels; credibility band; two audience rails.
22. **Mobile hierarchy:** Stacked panels and rails.
23. **Current-capability boundaries:** Partner API + sandbox `[T-API][T-EXT]`; embedded scenarios conceptual `[T-CONCEPT]`; no white-label/SDK claims `[T-NO]`; no named integrations `[T-NO]`; no scale/SLA numbers `[T-NO]`.
24. **Claims to avoid:** Named platforms/DJ software; SDK/on-device claims; engagement/revenue uplift; latency figures.
25. **Product confirmations:** Public description of integration scenarios.
26. **Technical confirmations:** Integration models (inherits P1-13).
27. **Legal/commercial confirmations:** Licensing model language `[C-COMM]`.
28. **Internal links:** `/developers`, `/partners/integrations`, `/trust`, `/partners`.
29. **Related pages:** Developers Overview, Integration Options, Catalogue Intelligence.
30. **SEO title:** "Resomix for Platforms & Music Technology — Embedded Sonic Discovery"
31. **Meta description:** "Metadata recommendations plateau. Embed sound-based similarity and analysis from Resomix into your platform, store, or music software — proven in our live beta, testable in the sandbox today."
32. **OG direction:** Integration-schematic card.
33. **FAQ/GEO:** "How do music platforms build similar-track recommendations?"; "How to add similar-track suggestions to a DJ app?"
34. **Accessibility:** Concept labelling not colour-only; schematic panels described in text.
35. **Dependencies:** Shared (§F); inherits P1-13 confirmations.
36. **Acceptance criteria:** Shared (§F) + engine claims cite only the live beta/hub; concept scenarios unmistakably labelled; combined-page rails serve both audiences without duplicating P1-13 content.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

## P1-11 — Partner Overview

1. **Page name:** Partner Overview
2. **Canonical route:** `/partners` (revision of the existing page)
3. **Current repository status:** **Existing but needs revision.** Current `PartnersPage.tsx` mixes positioning, 8-step onboarding carousel, sandbox key + curl, and the developer-registration form (`usePartners`). Proposal: `/partners` becomes the partner-journey hub; sandbox/registration preserved on-page (anchors `#sandbox`, `#contact` — CTA targets). **Nothing deleted.** `[SRC:REPO]`
4. **Implementation priority:** Wave A.
5. **Primary audience:** Partnership/licensing teams; catalogue-side decision-makers; enterprise buyers.
6. **Secondary audiences:** Developers (routed to sandbox/`/developers`); platform PMs.
7. **Visitor awareness:** Considering a commercial relationship.
8. **Visitor problem:** "What are the ways in, and how serious/safe is this?"
9. **Job to be done:** Understand the three partner paths (catalogue pilot, integration, API) and start the right conversation.
10. **Primary page promise:** Three ways to build with Resomix: pilot your catalogue, integrate discovery, or build on the API. `[T-PILOT][T-API][SRC:STRATEGIC]`
11. **Supporting message:** Working sandbox today `[T-API][T-EXT]`; managed pilot process `[T-PILOT][C-PRODUCT]`; trust posture at `/trust` `[C-LEGAL]`.
12. **Primary CTA:** CTA-6 Contact Partnerships (existing form anchor).
13. **Secondary CTA:** CTA-5 Start a Catalogue Pilot.
14. **Conversion destination:** On-page partner form (existing, verified).
15. **Required section order:** Hero → Three partner paths (pilot / integration / API, each linking its page) → How engagement works (adapt existing carousel content) → Sandbox section (existing, `#sandbox`) → Trust summary (link `/trust`) → Contact form (existing, `#contact`).
16. **Section purposes:** Orientation → routing → process credibility → technical proof → risk reduction → on-page conversion.
17. **Questions answered:** What partnership kinds exist? What happens after I reach out? Can engineers try something today? Where do I read about rights/security?
18. **Recommended evidence:** Existing sandbox/registration UI `[SRC:REPO]`; process steps.
19. **Screenshot/diagram:** Three-path junction diagram with routes.
20. **Visual treatment:** §31; keeps the technical-portal character.
21. **Desktop hierarchy:** Three-path panels above the fold after hero.
22. **Mobile hierarchy:** Paths stack; form reachable via anchor.
23. **Current-capability boundaries:** Sandbox + registration live `[T-API]`; pilot process description `[C-PRODUCT]`; no partner logos/testimonials (none exist).
24. **Claims to avoid:** Named partners; certification/security claims (link `/trust`); SLA language.
25. **Product confirmations:** Pilot process description; three-path naming.
26. **Technical confirmations:** Sandbox scope wording.
27. **Legal/commercial confirmations:** Form data-handling note `[C-LEGAL]`.
28. **Internal links:** `/partners/pilot`, `/partners/integrations`, `/trust`, `/developers`.
29. **Related pages:** All partner pages; Developers Overview.
30. **SEO title:** "Partner with Resomix — Catalogue Pilots, Integrations & API"
31. **Meta description:** "Pilot your catalogue, integrate sonic discovery, or build on the Discovery API. Start a partner conversation with Resomix — sandbox access available today."
32. **OG direction:** Three-path diagram card.
33. **FAQ/GEO:** "How do I partner with Resomix?"
34. **Accessibility:** Existing form labels/errors preserved.
35. **Dependencies:** Shared (§F); revision preserves anchors, form behaviour, `usePartners` wiring; content redistribution mapped before implementation.
36. **Acceptance criteria:** Shared (§F) + existing sandbox/registration functionality unchanged; `#sandbox`/`#contact` anchors stable.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-12 — Private Catalogue Pilot

1. **Page name:** Private Catalogue Pilot
2. **Canonical route:** `/partners/pilot`
3. **Current repository status:** Missing. Mechanism evidence: partner registration flow, ingestion API (admin-side), `DEMO_MODE` redaction `[SRC:REPO]`; blog partner CTA "REQUEST_CATALOGUE_EVALUATION" `[SRC:EXT]`. Pilot terms not defined in repo `[C-PRODUCT][C-COMM]`.
4. **Implementation priority:** Wave B.
5. **Primary audience:** Catalogue owners/managers; label/distributor decision-makers.
6. **Secondary audiences:** Legal/ops stakeholders.
7. **Visitor awareness:** Product-aware; evaluating commitment.
8. **Visitor problem:** Needs a bounded, private, low-risk way to evaluate catalogue intelligence on real material.
9. **Job to be done:** Understand pilot scope, effort, privacy posture, and outcome; submit an inquiry.
10. **Primary page promise:** A bounded private pilot: your catalogue, analysed; your questions, answered; your data, contained. — final wording gated `[C-PRODUCT][C-LEGAL]`.
11. **Supporting message:** Built on the live engine `[T-LIVE]`; managed, not self-serve `[T-PILOT]`; containment described only with approved language.
12. **Primary CTA:** CTA-5 (page form/inquiry → interim `/partners#contact`).
13. **Secondary CTA:** None (single-purpose page).
14. **Conversion destination:** Partner form (interim, verified) or dedicated pilot form (unresolved).
15. **Required section order:** Hero → Who it's for → How the pilot runs (numbered protocol, each step `[C-PRODUCT]`-gated) → What you receive (deliverables `[C-PRODUCT]`) → Privacy & containment (strictly P1-14-approved language) → Inquiry CTA.
16. **Section purposes:** Qualification → process transparency → outcome clarity → risk answer → conversion.
17. **Questions answered:** Who qualifies? What do we send and how (`[C-TECH]`)? Duration/effort (only if confirmed; else "scoped together")? Who sees our audio (approved language only)? What do we get?
18. **Recommended evidence:** Process diagram; redaction mechanism (qualitative) `[SRC:REPO]`.
19. **Screenshot/diagram:** Pilot-protocol diagram (Fira numbered steps).
20. **Visual treatment:** §31; second-most conservative page.
21. **Desktop hierarchy:** Narrow reading column; protocol emphasis.
22. **Mobile hierarchy:** Single column.
23. **Current-capability boundaries:** Managed service `[T-PILOT]`; all process/deliverable statements gated `[C-PRODUCT]`.
24. **Claims to avoid:** Duration/effort numbers; deliverable specifics; format support; deletion guarantees `[C-LEGAL]`; exclusivity/pricing `[C-COMM]`.
25. **Product confirmations:** Pilot steps, deliverables, qualification criteria.
26. **Technical confirmations:** Ingestion method/formats; environment separation claims.
27. **Legal/commercial confirmations:** All containment/deletion language; pilot terms; inquiry-form data handling.
28. **Internal links:** `/product/catalogue-intelligence`, `/trust`, `/partners`.
29. **Related pages:** Catalogue Intelligence, Trust, Partner Overview.
30. **SEO title:** "Private Catalogue Pilot — Evaluate Resomix on Your Catalogue"
31. **Meta description:** "Evaluate Catalogue Intelligence on your own material in a bounded, private pilot. Scoped together, run by the Resomix team, answered with real analysis."
32. **OG direction:** Protocol-diagram card, conservative.
33. **FAQ/GEO:** "How can we test sonic analysis on our catalogue?"
34. **Accessibility:** Standard (§F).
35. **Dependencies:** Shared (§F); hard-gated on P1-14 language — **cannot ship with placeholders visible**.
36. **Acceptance criteria:** Shared (§F) + zero unconfirmed process/containment claims in published copy.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-13 — Integration Options

1. **Page name:** Integration Options
2. **Canonical route:** `/partners/integrations`
3. **Current repository status:** Missing. Evidence: partner API + sandbox `[T-API][T-EXT]`; hub capability areas `[SRC:EXT]`. No documented integration-model matrix `[C-TECH]`.
4. **Implementation priority:** Wave C.
5. **Primary audience:** Technical decision-makers; platform/software PMs.
6. **Secondary audiences:** Developers; partnership teams.
7. **Visitor awareness:** Product-aware; comparing engagement shapes.
8. **Visitor problem:** "We want the capability — but as what? API calls, catalogue-side analysis, something embedded?"
9. **Job to be done:** Map their situation to an integration model; start the technical-commercial conversation.
10. **Primary page promise:** Choose the integration shape that fits: direct API, catalogue-side analysis, or a scoped custom integration. — model names gated `[C-TECH][C-PRODUCT]`.
11. **Supporting message:** Sandbox first `[T-API][T-EXT]`; models scoped with the team `[T-PILOT]`; commercial terms per partnership `[C-COMM]`.
12. **Primary CTA:** CTA-6 Contact Partnerships.
13. **Secondary CTA:** CTA-9 Request Sandbox Access.
14. **Conversion destination:** Partner form; sandbox anchor.
15. **Required section order:** Hero → Model matrix (2–4 models; each: what/who/requires — `[C-TECH]`-gated) → Decision helper ("if you are X → model Y") → Sandbox path → CTA block.
16. **Section purposes:** Orientation → comparison → self-qualification → proof → conversion.
17. **Questions answered:** Which shapes exist? Which fits us? What do we need (qualitative)? How do we validate before committing?
18. **Recommended evidence:** Model-comparison table; sandbox reference `[SRC:REPO][SRC:EXT]`.
19. **Screenshot/diagram:** Integration-model matrix (dotted-border table).
20. **Visual treatment:** §31/§32 hybrid; table-led.
21. **Desktop hierarchy:** Matrix centrepiece.
22. **Mobile hierarchy:** Matrix → stacked model cards.
23. **Current-capability boundaries:** Only API/sandbox path verified `[T-API][T-EXT]`; other models `[C-TECH][C-PRODUCT]` before publishing.
24. **Claims to avoid:** Embed/SDK/white-label offerings `[T-NO]`; timelines; support/SLA commitments `[T-NO]`.
25. **Product confirmations:** Which integration models are actually offered.
26. **Technical confirmations:** Requirements per model; sandbox→production path.
27. **Legal/commercial confirmations:** Commercial framing per model `[C-COMM]`.
28. **Internal links:** `/developers`, `/trust`, `/partners`, `/solutions/platforms-music-technology`.
29. **Related pages:** Developers Overview, Platforms & Music Technology, Trust.
30. **SEO title:** "Integration Options — Ways to Build with Resomix"
31. **Meta description:** "Direct API, catalogue-side analysis, or a scoped custom integration — compare the ways to bring Resomix sonic discovery into your product, starting in the sandbox."
32. **OG direction:** Matrix-styled card.
33. **FAQ/GEO:** "How can we integrate audio similarity into our platform?"
34. **Accessibility:** Proper `<th>` semantics; card fallback preserves relationships.
35. **Dependencies:** Shared (§F); matrix blocked on §25–27 confirmations — page cannot ship before they clear.
36. **Acceptance criteria:** Shared (§F) + matrix contains only confirmed models.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## P1-14 — Trust, Rights & Security

1. **Page name:** Trust, Rights & Security
2. **Canonical route:** `/trust` (cross-audience: individuals, partners, technical evaluators; linked from partner pages, `/developers`, and the footer). No `/partners/trust` route exists or redirects (never shipped).
3. **Current repository status:** Missing. Repo evidence remains thin by design: `DEMO_MODE` redaction, auth architecture (sessions, 2FA), artifact-deletion behaviour (Library delete-modal copy) `[SRC:REPO]`. **New verified external evidence:** the live Help Center legal library (Privacy Policy v7.0, Terms of Service v7.0, GDPR Summary v6.0, Cookie Policy, Acceptable Use, DMCA, Refund, Platform Disclaimer, Open-Source Music & Licensing Transparency — effective 2026-07-05; operator Reform Studios, Greece) `[SRC:EXT][T-EXT]`. The page may **link** to these documents; it must not paraphrase them into new claims without legal sign-off.
4. **Implementation priority:** Wave B (ships last within Wave B; blocks enterprise conversion but must not ship half-confirmed).
5. **Primary audience:** Legal/ops/security stakeholders at partners; catalogue owners.
6. **Secondary audiences:** Individuals asking "what happens to my uploads?"; enterprise buyers; technical evaluators.
7. **Visitor awareness:** Deep-evaluation stage.
8. **Visitor problem:** "Before our audio touches your systems: who sees it, where does it live, what rights do you take, what happens when we leave?" — and for individuals: "what happens to my uploaded tracks?"
9. **Job to be done:** Get direct, verifiable answers — or an honest statement of how the answer is provided (agreements, legal documents) instead of marketing.
10. **Primary page promise:** Straight answers about how audio and data are handled — for individuals and partners. Every substantive answer `[C-LEGAL]/[C-TECH]`-gated until confirmed.
11. **Supporting message:** Structure over claims; where a public claim isn't confirmed, the page states how the answer is provided (pilot agreements, the published legal library `[T-EXT]`).
12. **Primary CTA:** CTA-6 Contact Partnerships.
13. **Secondary CTA:** None.
14. **Conversion destination:** Partner form; legal library links (external, verified).
15. **Required section order:** Hero (posture statement) → For individuals (uploads, deletion — product-mechanism evidence) → Rights & ownership → Data handling & access → Catalogue privacy in the product (redaction mechanism `[SRC:REPO]`) → Deletion & offboarding → Security practices (`[C-TECH]` only) → Published legal documents (links to the verified Help Center library) → "What we don't claim" (explicit honesty section) → CTA.
16. **Section purposes:** Each section answers one diligence question class; the individuals section makes the page genuinely cross-audience; the honesty section pre-empts overreach.
17. **Questions answered:** Who owns what? Who can access audio? Is partner material exposed to consumers (redaction answer `[SRC:REPO]` + policy `[C-LEGAL]`)? What is deleted on exit (product-level verifiable `[SRC:REPO]`; contractual `[C-LEGAL]`)? What security practices exist (`[C-TECH]`)? Where are the legal documents (verified links `[T-EXT]`)?
18. **Recommended evidence:** Mechanism descriptions from code, scoped as product behaviour; links to published Privacy/ToS/GDPR docs `[T-EXT]`.
19. **Screenshot/diagram:** None; text-led.
20. **Visual treatment:** §31.
21. **Desktop hierarchy:** Narrow reading column, Fira section labels.
22. **Mobile hierarchy:** Same single column.
23. **Current-capability boundaries:** Verifiable today: demo-mode redaction, session/2FA auth, artifact deletion behaviour `[SRC:REPO]`; published legal documents exist `[T-EXT]`. Everything else requires confirmation.
24. **Claims to avoid (hard list):** High availability; offsite backups; encrypted media delivery; DDEX ingestion; catalogue isolation; data residency; deletion guarantees; security certifications; SLAs; rights-management controls; sub-processor commitments; guaranteed catalogue confidentiality. All `[T-NO]` without authoritative confirmation. Additionally: do not restate the blog's "region: EU (AT/DE)" or infer residency from it — observed inconsistency with the Greek-registered operator must be reconciled by legal first `[C-LEGAL]`.
25. **Product confirmations:** Which product mechanisms may be described publicly.
26. **Technical confirmations:** Any infrastructure/security statement, individually.
27. **Legal/commercial confirmations:** Every rights/ownership/deletion/confidentiality sentence; the "provided under agreement" framing; operator/region reconciliation; whether linking the legal library implies statements requiring review.
28. **Internal links:** `/partners/pilot`, `/partners`, `/product/catalogue-intelligence`, `/developers`.
29. **Related pages:** Pilot, Partner Overview, Catalogue Intelligence, Developers Overview.
30. **SEO title:** "Trust, Rights & Security — How Resomix Handles Audio and Data"
31. **Meta description:** "Who can access your audio, how catalogue privacy works in the product, what happens when you leave, and where our published legal documents live — direct answers for individuals and teams."
32. **OG direction:** Text-led minimal card.
33. **FAQ/GEO:** "Is my catalogue safe with sonic analysis platforms?"; "What happens to tracks I upload to Resomix?" — confirmed language only.
34. **Accessibility:** Definition-list semantics for Q&A pairs.
35. **Dependencies:** Shared (§F); **fully gated** — every published sentence confirmed; legal sign-off recorded before merge.
36. **Acceptance criteria:** Shared (§F) + zero claims from the §24 hard list; calmest visual register verified against the visual gate.

### Visual system status

Uses the approved Resomix-native visual system after design-lab approval.
Page-specific visual direction remains pending until the Product Overview reference is approved.

### Background and visual-craft status

Uses the approved shared background system and Premium Visual Craft Standard after Gate 4 approval.
Page-specific motif implementation remains pending.

---

## Open decisions

1. CTA-4 (Book a Partner Demo) destination — affects P1-9 secondary CTA.
2. Dedicated pilot-inquiry form vs existing partner form — affects P1-12 conversion.
3. Whether P1-12/P1-13/P1-14 ship in reduced form or wait for full confirmations (recommendation: wait; no placeholder pages).
4. Demo-catalogue public description wording (P1-2/P1-8).
5. Reuse of the hub's sandbox-catalogue description ("50,000+ CC-licensed tracks") in marketing copy (P1-5).
6. Future split of P1-10 (flagged; combined page stands for launch).

## Required confirmations

Consolidated: **Product** — surface naming; Track Intelligence availability wording; pilot scope/deliverables; screenshot policy; integration models; open-beta status; integration-scenario descriptions. **Technical** — analysis live-wiring status; ingestion formats; sandbox scope; `/api` redirect; hub↔site navigation; developer-support channel; per-model requirements; any security statement. **Legal** — all Trust-page language; containment/deletion wording; operator/region reconciliation; form data-handling notes; legal-library linking review. **Commercial** — pilot terms; partner licensing framing; demo-booking mechanism.

## Change history

- 2026-07-22 — Revision 3: visual direction reset — removed the rejected visual concept blocks; added Visual system status placeholders pending `docs/design-lab/` approval. Strategic content (audiences, problems, CTAs, truth labels, SEO, acceptance) unchanged. Author: Claude.
- 2026-07-22 — Revision 2: British public spelling; 14 pages; Developers Overview; combined Platforms & Music Technology; `/trust` cross-audience. Author: Claude.
- 2026-07-22 — Initial draft proposal. Author: Claude.
