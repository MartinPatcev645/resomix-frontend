# SEO & Performance — Full Record

Single source of truth for the SEO / performance workstream on `resomix.com` and
`beta.resomix.com`.

- **Part 1** — everything done, in the order it was done, with the reasoning and the decisions taken
  along the way (including the ones that turned out wrong).
- **Part 2** — all three PageSpeed Insights runs, recorded verbatim so they can be compared.
- **Part 3** — where the site stands today: what is fixed, what regressed, and why.
- **Part 4** — what remains.
- **Part 5** — the plan to reach a genuinely professional score.

> **Reading note.** Numbers labelled *measured* come from the build output or the live site and are
> reproducible. Numbers from Lighthouse are lab-simulated and vary between runs. The site has **no
> field data (CrUX)** yet — "Discover what your real users are experiencing: No Data" — so every
> Lighthouse figure here is simulated, not observed.

---

# Part 1 — What was done, in order

## 1.1 Centralised route metadata

`apps/landing/src/routes/seoConfig.ts` (22 routes) and `apps/webapp/src/routes/seoConfig.ts`
(19 routes). One file per app holding title, description, changefreq, priority, `noindex`, and an
optional cross-origin canonical.

**Why:** the head and the sitemap were maintained independently and had drifted badly.

**What it replaced:**

- `public/sitemap.xml` was hand-written. It advertised `/terms` and `/privacy` — never routes — and
  listed **one** of the seventeen marketing pages.
- Titles were set by an ad-hoc `document.title` effect in **16 separate page components**; the other
  four had none and inherited whatever the previous page left behind.
- `index.html` hardcoded `<link rel="canonical" href="https://resomix.com/">`, which every route
  inherited. All twenty URLs were declaring themselves to be the homepage.

## 1.2 Runtime head management

`packages/hooks/src/Seo/useDocumentMeta.ts` — one shared implementation that writes title,
description, canonical, robots, Open Graph and Twitter tags. Each app has a thin `RouteMeta`
component that reads its own config and mounts once next to `<Routes>`.

**Decision — shared hook, per-app data.** Both apps had the same defect; only the route→metadata
mapping differs.

**Quality rules, enforced by tests:** unique titles ≤ 60 chars (SERP truncation), unique descriptions
50–160 chars, unknown paths get `noindex, follow` and the 404 title, trailing slashes collapse
(`/trust/` → `/trust`).

## 1.3 Generated sitemaps

A Vite plugin emits `dist/sitemap.xml` from `seoConfig` at build time. `public/sitemap.xml` deleted
in both apps; a test fails if it reappears.

- Landing: **20 indexed URLs** of 22 routes (`/error`, `/404` excluded as `noindex`)
- Webapp: **3** — `/`, `/sonic-discovery`, `/analysis`

Verified zero dead URLs; every exclusion is a redirect, a beta hand-off, or `noindex`.

## 1.4 Static head prerendering

**Problem:** link previews on WhatsApp, Slack, iMessage, LinkedIn and Upwork showed the homepage for
every URL. This is an SPA — every URL served the same `index.html`, and `RouteMeta` only rewrites the
head after React boots. Those scrapers **do not execute JavaScript**. Runtime head management cannot
reach them, by construction. (Googlebot renders JS, so search was never affected.)

**Fix:** `tooling/prerenderHead.ts` emits `dist/<route>/index.html` per route with the head already
correct. Cloudflare Pages serves a directory's `index.html` for that path.

- Landing **26 files + 404.html**, webapp **18 + 404.html**
- Head-only — the body is still client-rendered, which is all a preview needs
- Verified: body below `<head>` byte-identical to the shell; asset URLs stay absolute (a relative
  path would make nested pages request `/solutions/producers/assets/…` and fail to boot); `&` escaped

**Decision — head-only, not full SSG.** George's strategy doc asks for the rendered H1 and body in
the initial HTML too. That is a much larger change; head-only solved the reported symptom at a
fraction of the risk. Full body prerendering remains open (§4.3).

## 1.5 Crawl posture

**Landing:** `_headers` with immutable hashed assets and always-revalidated HTML. Favicon `type`
corrected (declared `image/svg+xml`, was a PNG).

**Webapp — it contradicted itself three ways:**

| | Before | After |
|---|---|---|
| `index.html` | `noindex, nofollow` | `index, follow` |
| `robots.txt` | `Disallow: /*/` blocked every subpage | allows crawl; per-page `noindex` does the work |
| sitemap | 4 hand-written URLs, all blocked | generated, 3 real pages |

`nofollow` removed entirely — it stranded link equity for no benefit.

**Decision — crawlable but `noindex`, not robots-blocked.** `/library`, `/profile`, `/sessions`,
`/change-password` and the six `/auth/*` screens carry `noindex`. A page blocked in `robots.txt` is
never fetched, so its `noindex` is never read, and the URL can still surface as a bare link.

**Decision — cross-origin canonicals.** `/subscribe` and `/contact` render the *same shared
components* on both origins. Both canonicalise to `resomix.com` and are excluded from beta's
sitemap. They stay `index, follow` on purpose: `noindex` + `canonical` is a contradictory pair.

The canonical also drops the query string, collapsing the effectively infinite
`/sonic-discovery?id=…` playlist URLs onto one page.

**Embed:** stays `noindex, follow` (correct for a widget). Its `og:image` was relative `/logo.png` —
scrapers do not resolve relative URLs, so shared embeds previewed with no image. Now absolute.

## 1.6 Structured data

JSON-LD in the static HTML so it is read without executing the app: `Organization` + `WebSite`
(landing), `WebApplication` (webapp).

## 1.7 Font delivery rebuilt — the single biggest performance change

**The problem, measured:** `dist/fonts` was **12 MB across 47 files with zero woff2**. Each Helvetica
Neue face carried ~2,200 codepoints — Latin, Greek, Cyrillic, **Georgian and Cherokee**. The eight
faces the homepage used came to **994 KiB on the wire**. Lighthouse put a font at the END of the
critical path on both form factors and attributed **100 % of the desktop CLS** to font swap.

**Decision — subsetting, not just format conversion.** Converting to woff2 alone was measured at only
**21 %** on the wire (994 → 781 KiB), because Cloudflare already gzips `.otf`. The real lever was
glyph coverage.

**Decision — `unicode-range` split, not a single subset.** Every face ships as two files:

| | `.latin.woff2` | `.ext.woff2` |
|---|---|---|
| Covers | Latin + punctuation, super/subscripts, currency, letterlike, number forms, arrows, maths, misc-technical, box-drawing, geometric shapes, misc symbols, dingbats | Greek + Cyrillic |
| Fetched | always | only when such text is present |

Greek and Cyrillic kept because the team is in Thessaloniki and the catalogue carries international
artist names. They cost nothing on an English page.

**Decision — range verified against real content before committing.** Every non-ASCII character in
the locale file and all TSX was extracted and checked. That caught `⌘`, `─` and `═`, which an
ordinary Latin subset would have dropped. (`💪` is dropped, but it was never in the font — no
regression.) Later re-checked with comments stripped: `⌘` and `═` appear only in code comments; `─`
is genuinely rendered in the global footer's terminal divider. Cost of keeping both blocks: **0.3 KB**.

**Montserrat deleted** — 18 faces, 4.6 MB, referenced by nothing.
**Auger Mono kept** despite appearing unused — `.font-auger` is used by
`packages/ui/src/Elements/SearchDropdown.tsx`. It was nearly deleted.

**Sources moved to `/fonts-src`** (not deployed). Only generated `.woff2` ships.
`tooling/buildFonts.py` regenerates everything.

**Preloads: 3, not 11.** The webapp preloaded eleven `.otf`/`.ttf` files, all of which this change
made dangling — and preloading everything only front-loads the same bytes. Now Benzin 700 (hero
`<h1>`), Helvetica 300 (body), Fira Code 500 (nav).

**Measured:** homepage font payload **994 → 333 KiB (67 %)**. Deployed font directory **12 MB → 1.7 MB
per app**.

> ⚠️ This preload set later proved incomplete. The face causing the remaining CLS is
> **`FiraCode-Light`**, which is not among the three — see §3.2.

## 1.8 Real 404 at the edge

Cloudflare Pages served `index.html` with a **200** for every unmatched path — a soft 404. Lighthouse
caught it via the `llms.txt` audit: it fetched `/llms.txt`, got the SPA shell with a 200, and tried
to parse HTML as Markdown. Every non-existent path behaved the same way, which also lets junk URLs
into the index.

**Fix:** emit `dist/404.html`, which switches Pages to a genuine 404.

**The trap that creates:** from then on, **any path without a file is a 404** — including real routes.
Handled by enumerating the gaps *from the router*, not from memory:

- 22 SEO routes → already prerendered
- `extraRoutes` → shells for `/pricing`, `/product/catalogue-intelligence`, `/profile`, `/sessions`,
  `/change-password` (two redirects, three beta hand-offs), `noindex` but titled with the site
  default — calling them "Page not found" would tell a scraper something untrue
- `/auth/*` is a wildcard (emailed verify/reset links) so it cannot be a static file →
  `public/_redirects` rewrites it to the shell with a **200**, scoped to `/auth/` so it cannot shadow
  a prerendered page

A real `public/llms.txt` was added — Markdown, `# Resomix` H1, links to every live route.

## 1.9 Copy from `SEO_METADATA_ALL_PAGES.md`

Per George: that document is authoritative for titles, descriptions and H1s; the `.docx` is for
advice and implementation flow only.

- **Titles + descriptions** — 19 landing routes, plus `/subscribe` and `/contact` on beta (they
  canonicalise to landing, so they must match). Max title 59, max description 159.
- **All 17 H1s**, each with a `[[…]]` accent phrase so the keyword takes the brand colour.
- **Hero systems unified** — seven heroes still used `h1Lead`/`h1Em` key pairs that pinned the accent
  to a fixed position; all 17 now use the inline marker, so moving emphasis is a copy edit. 16 dead
  locale keys removed.

**One entry needed interpretation.** `/product/sonic-discovery`'s H1 field is not copy — it reads
*"SONIC DISCOVERY — approved live hero line"*, i.e. "keep what's live". But the doc moves that live
line ("Drop one track. Find what belongs next.") to the homepage, which would have put an identical
H1 on two pages — the cannibalisation the strategy doc warns about. It now reads
**"Find similar tracks by sound."**, taken from that page's own doc title and stated intent.

**Edge 301s** added for `/pricing` → `/subscribe` and the catalogue spelling. Both were client-side
`<Navigate replace>` only, so the server answered 200 twice and crawlers saw no redirect signal.

## 1.10 Third-party staging

| When | What |
|---|---|
| eager | Silktide consent banner — functional, and it gates the rest |
| idle | Google One Tap (98 KiB) — user-facing, so it goes first |
| idle + 1.5 s | Google Tag Manager (119 KiB) → PostHog (182 KiB, 7 scripts) |

**Key finding: PostHog is not a dependency of this repo.** No package, no init code — the GTM
container loads it. So PostHog can never start before GTM, and deferring GTM defers both:
~301 KiB and ~375 ms of main-thread work off the critical path.

**Kept inline and synchronous:** the `gtag('consent','default',{…denied})` snippet, which Consent
Mode v2 requires to run *before* the container, and the `<noscript>` iframe. On beta's `/auth/*`
routes One Tap stays immediate — signing in is the point of those pages.

**Caching:** these are per-document, not per-page. SPA navigation does not re-fetch them; a reload
re-uses the browser cache subject to each vendor's TTL (PostHog's is 4 h, set by their CDN and not
controllable from here). The cost is a first-visit cost, which is what deferring addresses.

## 1.11 Bundle: the vendor chunk

Lighthouse reported `vendor-*.js` at 188.6 KiB with **153.2 KiB unused (81 %)**. Attributing it with
the newly-enabled source maps:

| Package | Share of vendor |
|---|---|
| **hls.js** | **67.1 %** (1,268 K pre-minify) |
| @remix-run/router | 10.2 % |
| howler | 5.6 % |
| axios | 5.4 % |
| i18next | 4.1 % |
| jsmediatags | 2.7 % |

The marketing site was shipping the **entire audio stack** — HLS streaming, Howler, ID3 parsing — on
pages with no player. It arrived through the `@resomix/hooks` barrel: landing imports five hooks, and
because **no workspace package declared `sideEffects`**, Rollup had to assume every re-exported module
might have side effects and could not drop any.

**Fix:** `"sideEffects": ["*.css"]` on all five packages.

**Decision — `["*.css"]`, not `false`.** `packages/ui` has two real stylesheet imports
(`design-system/index.ts`, `ContourSphere.tsx`) that a blanket `false` would have silently dropped.

**Measured: vendor 588 K → 95 K raw.** Verified `hls.js`, `howler` and `jsmediatags` absent from every
landing chunk, and that the webapp still bundles what it uses. `howler` dropped from the webapp too —
correct, because its only consumer is `PlayerPage`, whose route is commented out in `App.tsx`.

## 1.12 Bundle: locale splitting

`locales/en/common.json` was 204 KiB (**56.5 KiB gzipped**), statically imported, so every visitor
downloaded the copy for all twenty pages to read one.

The 20 top-level namespaces map 1:1 onto pages, and a scan confirmed **no section referenced another
section's namespace** — so the split was safe:

- `locales/en/core.json` — `nav`, `general`, `waitlist` (**2.5 K gzipped**), eager
- `locales/en/pages/<ns>.json` × 17 — fetched by `pageLoaders.ts` **alongside the route chunk**

**Decision — load the slice with the chunk, not after it.** Both promises are awaited together and
`addResourceBundle` runs before the module resolves, so React can never mount a component whose
strings are missing — that would render a raw `about.hero.title` for a frame.

`i18next-browser-languagedetector` removed: one locale, no switching, so detection could only ever
resolve to `en`. `lng: 'en'` is now explicit, which is also more predictable — detection read
localStorage and could be influenced by another app on the origin.

**Measured: entry chunk 236 K → 72 K raw.**

## 1.13 Security headers

Previously **none** were set. Now on both apps: `Strict-Transport-Security` (2 y, includeSubDomains,
preload) · `X-Content-Type-Options: nosniff` · `X-Frame-Options: SAMEORIGIN` ·
`Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy` (camera, mic, geolocation,
payment, USB, magnetometer denied) · `Cross-Origin-Opener-Policy: same-origin-allow-popups`.

**Decision — COEP omitted.** It would break third-party embeds and images that do not send CORP.

**Decision — CSP ships `Report-Only`.** It has to cover GTM plus whatever GTM injects, and an enforced
CSP that is slightly wrong is an outage. Report-Only surfaces violations without blocking.

**Decision — embed excluded from frame rules.** Being iframed elsewhere is its entire purpose.

> ⚠️ The Report-Only CSP is the prime suspect for the Best Practices and TBT regressions — see §3.3.

## 1.14 Social card

A real **1200×630** `og-cover.png`, generated in the brand fonts (Benzin headline with accent split,
Helvetica sub, Fira footer, hairline frame) and wired into both apps. Previously the 399×399 logo,
which every platform cropped to a small square.

## 1.15 Smaller items

- **void-grain tile → lossless WebP** — 45.6 K → 24.1 K. Lossy was measured and gave no further gain
  (noise defeats it); 16 importers updated.
- **`public/scripts/` minified at build** (`tooling/minifyPublicScripts.ts`) — `resomix-consent.js`
  50.8 K → 23.2 K raw, 11.9 → 6.6 K gzipped; its CSS 11.5 → 8.1 K. Source stays readable; Vite does
  not process `public/`.
- **Production source maps** enabled — separate `.map` files, fetched only with DevTools open. This
  is what made the vendor attribution in §1.11 possible.
- **Footer touch targets** — the legal/support links had ~16 px tap areas stacked flush; now ≥ 24 px
  with spacing. (A Best Practices failure introduced by earlier footer work.)
- **Anonymous 401 silenced.** `useAuthInit` attempts a refresh on first load even without a local
  token, because the cookie is scoped to `.resomix.com` and may carry a beta session. With no cookie
  the server correctly answers 401 — expected, not an error. No longer logged; anything else still is.
- **IndexNow key file** at `public/<key>.txt` with a README. Nothing pings automatically — that is
  outward-facing and deliberately left manual.
- **Link anchors — checked, no change needed.** Zero generic "Learn more"/"Click here" anchors exist;
  Lighthouse's "Links have descriptive text" already passes. The repeated labels ("Start a Catalogue
  Pilot") are descriptive and intentionally reused across pages.

## 1.16 Preconnect, twice

**First attempt:** four preconnects (PostHog, API, GTM, Google accounts). Lighthouse then warned
*"More than 4 preconnect connections were found"* and *"bserver.resomix.com — Unused preconnect.
Check that the `crossorigin` attribute is used properly."*

**The bug:** a bare `crossorigin` means *anonymous*, but the API client sends `withCredentials: true`,
so the connection never matched and was never reused.

**Second attempt:** one preconnect — `bserver.resomix.com` with `crossorigin="use-credentials"`. The
other three were dropped: all are now deferred to idle, so warming their sockets during load buys
nothing and crowded out the one connection actually on the critical path.

> ⚠️ Still reported as "Unused preconnect" in run 3. Unresolved — see §4.1.

## 1.17 The deploy that never shipped

Runs 1 and 2 both showed `vendor-f9M9xD2Z.js` — the **same content hash**. Content-hashed filenames
do not collide, so that chunk had never changed.

**Cause:** `i18next-browser-languagedetector` was removed from `apps/landing/package.json` but
`pnpm-lock.yaml` was never regenerated. Local builds kept passing because `node_modules` already had
everything resolved. CI installs with `--frozen-lockfile` and refuses:

```
ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
pnpm-lock.yaml is not up to date with <ROOT>/apps/landing/package.json
* 1 dependencies were removed: i18next-browser-languagedetector@^8.2.0
```

**Every push after that commit failed at the install step, before the build ever ran.** The site kept
serving the last successful deploy.

**Fix:** regenerated the lockfile (10 lines changed, all removals of that one package) and reproduced
CI's gate locally — `pnpm install --frozen-lockfile` now exits 0.

**Lesson recorded:** a passing local build is not evidence that CI will pass. Editing a `package.json`
dependency requires regenerating the lockfile and verifying with a frozen install.

---

# Part 2 — The three PageSpeed runs

All: `https://resomix.com/`, Lighthouse 13.4.1, HeadlessChromium 150.0.7871.186, single page session,
initial page load. Mobile = emulated Moto G Power on **Slow 4G**; desktop = emulated desktop, custom
throttling. **Field data: No Data** in all three runs.

## 2.1 Scores across all three runs

| | **Run 1** baseline<br>Aug 3, 22:02 | **Run 2** partial deploy<br>Aug 4, 13:26 | **Run 3** full deploy<br>Aug 4, 14:10 |
|---|---|---|---|
| **Performance — mobile** | 56 | 64 | **66** |
| **Performance — desktop** | 78 | **96** | **69** |
| Accessibility — mobile | 96 | 100 | 100 |
| Accessibility — desktop | 96 | 96 | 96 |
| Best Practices | 96 | 96 | **92** |
| SEO | 100 | 100 | 100 |
| Agentic Browsing | 2/3 | 3/3 | **2/3** |

## 2.2 Metrics across all three runs

**Mobile**

| Metric | Run 1 | Run 2 | Run 3 | vs baseline |
|---|---|---|---|---|
| First Contentful Paint | 10.7 s | 4.6 s | **1.8 s** | **−83 %** ✅ |
| Largest Contentful Paint | 12.3 s | 6.3 s | **5.4 s** | **−56 %** ✅ |
| Speed Index | 10.7 s | 5.6 s | **2.5 s** | **−77 %** ✅ |
| Total Blocking Time | 0 ms | 60 ms | **200 ms** | worse 🔻 |
| Cumulative Layout Shift | 0 | 0 | **0.191** | worse 🔻 |

**Desktop**

| Metric | Run 1 | Run 2 | Run 3 | vs baseline |
|---|---|---|---|---|
| First Contentful Paint | 0.6 s | 0.6 s | **0.4 s** | −33 % ✅ |
| Largest Contentful Paint | 2.2 s | 1.2 s | **1.1 s** | **−50 %** ✅ |
| Speed Index | 2.9 s | 0.9 s | **0.8 s** | **−72 %** ✅ |
| Total Blocking Time | 110 ms | 60 ms | **200 ms** | worse 🔻 |
| Cumulative Layout Shift | 0.087 | 0.062 | **0.675** | much worse 🔻🔻 |

**Critical path latency:** mobile 1,766 → 1,144 → **1,072 ms**; desktop 4,403 → 1,152 → **1,278 ms**.

## 2.3 Run 1 — the baseline (Aug 3)

Total page weight **1,872 KiB**.

**Root cause #1 — fonts (994 KiB, 8 files, all `.otf`/`.ttf`).** A font was the terminal node of the
critical path on both form factors:

| Font | Size | Mobile | Desktop |
|---|---|---|---|
| HelveticaNeueRoman.otf | 247.8 KiB | 1,109 ms | 3,710 ms |
| HelveticaNeueBold.otf | 240.7 KiB | 1,681 ms | 4,380 ms |
| HelveticaNeueLight.otf | 118.6 KiB | 1,660 ms | 4,348 ms |
| FiraCode-SemiBold.ttf | 84.1 KiB | 1,707 ms | 4,383 ms |
| **FiraCode-Medium.ttf** | 83.9 KiB | **1,766 ms** ← | **4,403 ms** ← |
| FiraCode-Regular.ttf | 83.8 KiB | 1,131 ms | 3,711 ms |
| FiraCode-Light.ttf | 83.5 KiB | 1,724 ms | 4,383 ms |
| benzin-bold.ttf | 51.6 KiB | 1,708 ms | 4,382 ms |

Chain: `HTML → index.css → 8 fonts`. Fonts were ~13× the JavaScript.

- Desktop LCP element `<h1 class="hm-benzin uppercase">` — element render delay **4,430 ms**, TTFB 0
- Mobile LCP element was the **beta banner paragraph** — the hero had not rendered at 12.3 s
- Desktop CLS 0.087 was **entirely font-swap reflow** (0.059 nav via FiraCode-Medium, 0.026 hero art)

**Root cause #2 — third-party JS exceeded first-party.**

| Party | Transfer | Main thread | Unused |
|---|---|---|---|
| posthog.com | 182 KiB | 307 ms | 88.7 KiB |
| Google Tag Manager | 119 KiB | 68 ms | 63.0 KiB |
| Google GSI (One Tap) | 98 KiB | 19 ms | 71.7 KiB |
| **Total** | **~399 KiB** | **~394 ms** | **223 KiB** |

First-party was 249 KiB. PostHog alone loaded **seven** scripts and was responsible for 100 % of
three separate audits: cache lifetimes (123 KiB on a 4 h TTL), legacy JavaScript (43.6 KiB of
polyfills for `Array.prototype.at`, `Array.from`, `Math.trunc`) and duplicated JavaScript (8 KiB).

**No origins preconnected.** Candidates: `eu.i.posthog.com` (370 ms), `bserver.resomix.com` (320 ms).

**Root cause #3 — unused first-party JS, 399 KiB total.** `vendor` 188.6 KiB with **153.2 KiB unused
(81 %)**; `react` chunk 60.4 KiB with 22.1 KiB unused.

**Other:** render-blocking est. savings **4,990 ms** · void-grain PNG 45.6 KiB (39.6 saveable) ·
`resomix-consent.js` 11.9 KiB **unminified** · forced reflow 83 ms · non-composited
`stroke-dashoffset` animation · DOM 1,603 elements.

**Best Practices 96** — failing: touch targets (the footer legal/support links), console errors
(PostHog API errors, a **401** from `authRefresh`, `ERR_NAME_NOT_RESOLVED`), missing source maps.
**Trust & Safety: CSP, HSTS, COOP, XFO and Trusted Types all unset.**

**Agentic Browsing 2/3** — `llms.txt` failed: *"missing a required H1"*, *"does not appear to contain
any links"*. Cause: the file did not exist and the SPA fallback returned `index.html` with a 200.

## 2.4 Run 2 — partial deploy (Aug 4, 13:26)

**This run did not contain the tree-shaking fix** — `vendor-f9M9xD2Z.js`, byte-identical to run 1
(see §1.17). Everything up to and including third-party staging was live.

**What improved:** mobile FCP 10.7 → 4.6 s, LCP 12.3 → 6.3 s, SI 10.7 → 5.6 s. Desktop LCP 2.2 → 1.2 s,
SI 2.9 → 0.9 s, TBT 110 → 60 ms, CLS 0.087 → 0.062. **Desktop Performance 78 → 96.**

- **5 fonts, ~237 KiB** on the chain instead of 8 at 994 KiB; the three preloaded faces left the
  chain entirely, exactly as intended
- Render-blocking est. savings 4,990 → **1,410 ms**
- Mobile LCP element became the hero `<h1>` (was the beta banner)
- `llms.txt` fixed → **Agentic Browsing 3/3**
- Footer tap targets fixed → **mobile Accessibility 100**
- Lighthouse warned about **>4 preconnects** and flagged the API one as **unused** (§1.16)

## 2.5 Run 3 — full deploy, after a Cloudflare purge (Aug 4, 14:10)

`vendor-C_iyh9Pb.js` live — the tree-shaking shipped. Entry chunk **25.72 KiB transfer** (was 77.36).

**What improved further:** mobile FCP 4.6 → **1.8 s**, SI 5.6 → **2.5 s**, LCP 6.3 → **5.4 s**.
Desktop FCP 0.6 → **0.4 s**, LCP 1.2 → **1.1 s**, SI 0.9 → **0.8 s**.

**What regressed:**

| | Run 2 | Run 3 |
|---|---|---|
| CLS mobile | 0 | **0.191** |
| CLS desktop | 0.062 | **0.675** |
| TBT both | 60 ms | **200 ms** |
| Best Practices | 96 | **92** |
| Agentic Browsing | 3/3 | **2/3** |

**Mobile layout-shift culprits:**

| Shift | Element | Attributed to |
|---|---|---|
| **0.176** | `div.mx-auto.text-[var(--color-text-secondary)].relative.z-30` (page shell — "PRODUCTION BETA · POWERED BY PYXIS-1 DROP ONE TRACK…") | **`/fonts/FiraCode-Light.latin.woff2` (Web font)** |
| 0.015 | `<div class="relative z-30 w-full max-w-[300px] p-5">` (the boot loader) | — |

**Desktop:** total 0.675 — two shifts of **0.305 each with no element attributed** (what Lighthouse
reports for document-level reflow), plus 0.059 on the nav and 0.002.

**Still open in run 3:** preconnect still "Unused" despite `use-credentials` · void-grain 18.1 KiB
more available · forced reflow 89 ms mobile / 77 ms desktop · PostHog's own 181 KiB / 4 h TTL /
44 KiB legacy polyfills (their CDN, not ours) · DOM 1,605 elements.

---

# Part 3 — Where the site stands

## 3.1 What is genuinely fixed

- **SEO 100/100** on both form factors, all three runs
- **Mobile Accessibility 100**
- **Mobile FCP −83 %, Speed Index −77 %, LCP −56 %** against baseline
- **Desktop Speed Index −72 %, LCP −50 %**
- Critical path more than halved on mobile, cut to under a third on desktop
- Fonts 994 → 333 KiB; deployed font dir 12 MB → 1.7 MB per app
- vendor 588 → 95 K; entry 236 → 72 K
- ~301 KiB of third-party JS off the critical path
- Real 404s, per-route link previews, generated sitemaps, security headers, a proper social card

## 3.2 The CLS regression — caused by our own speedup

**Mechanism.** Mobile FCP went from 10.7 s to 1.8 s. The page now paints *before* the fonts arrive,
so text renders in the fallback and re-flows when the web font swaps. Previously the page painted so
late that fonts had already landed — the shift existed but was hidden inside the slowness.

Lighthouse names the file: **0.176 of mobile's 0.191 is attributed to `FiraCode-Light.latin.woff2`.**

Desktop is worse (0.675) because it paints at 0.4 s, even further ahead of the fonts, and the reflow
is large enough that Lighthouse cannot attribute it to a single element.

**Why the preloads did not prevent it.** Three faces are preloaded — Benzin 700, Helvetica 300,
Fira Code 500. The culprit is **Fira Code 300 (Light)**, which still loads through the CSS chain.

**This also explains Agentic Browsing 3/3 → 2/3** — that category includes a CLS audit. `llms.txt`
still passes.

## 3.3 TBT and Best Practices — one likely cause

TBT 60 → 200 ms and Best Practices 96 → 92 regressed together, on both form factors, in the run that
first shipped the **Report-Only CSP**.

Chrome evaluates every resource against a Report-Only policy and logs `[Report Only] Refused to…` for
each violation. Those are console **errors**, which feed the "Browser errors were logged to the
console" audit — and the evaluation itself costs main-thread time.

**Not yet confirmed** — it needs the live console read, or the Best Practices detail page. But it is
the only change in that deploy that plausibly adds main-thread work, and shipping Report-Only was
precisely so that a too-tight policy could be found without breaking anything.

## 3.4 The Cloudflare purge is not distorting these numbers

A cold edge cache would slow FCP/LCP — instead both improved. The CLS is attributed to a named font
file, not to variance. What the purge did do is guarantee run 3 measured the new build, confirmed by
the new vendor hash.

---

# Part 4 — What remains

## 4.1 Regressions to close

| Priority | Item |
|---|---|
| **P0** | CLS — metric-matched fallback fonts (§5.1) |
| **P0** | Confirm and tighten the Report-Only CSP; recover TBT and Best Practices (§5.2) |
| P1 | Preconnect still reported "Unused" despite `use-credentials` |

## 4.2 Performance, still open

- **void-grain tile** — 24.1 KiB, Lighthouse says 18.1 KiB more available. Lossless was the wrong
  call for it; test AVIF and lossy at reduced dimensions.
- **Forced reflow** — 89 ms mobile / 77 ms desktop, `vendor-C_iyh9Pb.js:2:1406` via
  `index-Dgvg91xq.js:2:38950`. Now traceable because source maps ship.
- **Desktop Accessibility 96** — mobile reached 100; something desktop-specific remains, not yet
  identified.
- **PostHog's own overhead** — 181 KiB, 44 KiB legacy polyfills, 4 h cache TTL, ~218 ms main thread.
  Set by their CDN; unchangeable from here. The only lever is dropping `posthog-recorder` (session
  replay, 55 KiB) from the GTM container.
- **`stroke-dashoffset` animation** — deliberately not changed. It cannot be composited without
  altering the hero visual, it is already gated behind the in-view class, and it costs nothing
  measurable.

## 4.3 From George's `.docx` — three real items

- **§4 GEO content structure — not started.** A 40–70 word plain definition near the top of every
  product and solution page, plus visible question-led sections, aimed at AI answer engines. This is
  a **content** task and needs Marco's copy.
- **§5 Structured data — partial.** `Organization` + `WebSite` + `WebApplication` ship. Still missing
  per-page `WebPage`, `BreadcrumbList`, `isPartOf`, `about`, `mainEntity`, and `Service` on the
  partner/pilot pages. **This can be done without copy approval.**
- **§6 Body prerendering — DONE.** See §1.18.

Its §7 checklist is otherwise complete — verified: 7/7 images have alt text, `prefers-reduced-motion`
is honoured in 38 files, anchors are descriptive, canonicals self-reference, the sitemap is
canonical-only, robots.txt does not block CSS/JS.

## 4.4 From `SEO_METADATA_ALL_PAGES.md` — one item

Its own flag on `/contact`, applied verbatim and still live:

> *"FLAG: 'reply within the beta' phrasing is a placeholder — replace with an approved
> support-response statement or trim."*

The description currently ends **"We reply from support@resomix.com within the beta."**

## 4.5 Needs account access

- Submit both sitemaps to **Google Search Console** (Domain property + DNS TXT in Cloudflare covers
  all subdomains) and **Bing Webmaster Tools** (import from GSC)
- Wire the **IndexNow** ping into the deploy — key file already ships
- **Re-run PageSpeed** after each change set

---

# Part 5 — The plan to get this genuinely professional

Target: **90+ on both form factors**, with all Core Web Vitals green.

## 5.1 Kill the CLS properly — metric-matched fallback fonts

Define a fallback `@font-face` per family using `size-adjust`, `ascent-override`, `descent-override`
and `line-gap-override`, computed from the real font metrics with fontTools. The fallback then
occupies **exactly the same space** as the web font, so the swap causes zero reflow.

| Option | Verdict |
|---|---|
| **Metric-matched fallbacks** | ✅ Zero extra bytes, zero visual change, eliminates the shift. What Next.js does automatically. |
| Preload the remaining 5 faces | ❌ Front-loads ~237 KiB and pushes FCP back up — undoes what we just won |
| `font-display: optional` | ❌ No shift, but the font may never apply on a slow connection — a visual change |
| `font-display: block` | ❌ Trades CLS for invisible text (FOIT) |

**Expected:** CLS → near 0 on both. CLS is 25 % of the Lighthouse performance weighting, so this
alone should take desktop back above 90 and lift mobile several points.

## 5.2 Tighten the CSP

Read the live console, collect every `[Report Only]` violation, add the legitimate origins, re-measure
TBT and Best Practices. If the policy proves noisy in ways that cannot be cleanly resolved, the
fallback is to drop `Report-Only` until it can be tuned against real traffic — the header buys
nothing while it is only reporting.

## 5.3 Then the remaining smaller wins

In order of expected value: void-grain re-compression (−18 KiB) → forced-reflow trace → desktop
accessibility → per-page structured data.

## 5.4 What "great on PageSpeed" realistically looks like

Mobile is measured on a **Moto G Power over Slow 4G** — a deliberately punishing profile. With CLS
fixed and the CSP settled, the honest expectation is:

- **Desktop: 95–100.** It was already at 96 in run 2 with a *worse* bundle.
- **Mobile: 80s.** LCP is the binding constraint at 5.4 s. Getting it under 2.5 s on that profile
  needs the hero to render without waiting on JavaScript at all — i.e. **body prerendering (§4.3)**,
  which is also what George's doc asks for. That is the single change that would move mobile into
  the 90s, and it is a real project rather than a tuning pass.

**Recommended order:** §5.1 → §5.2 → re-measure → then decide whether body prerendering is worth
scheduling, based on what LCP actually reports at that point.
