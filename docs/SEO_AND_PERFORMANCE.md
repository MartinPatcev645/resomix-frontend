# SEO & Performance — Baseline Audit and Work Completed

Reference document for the SEO / performance workstream. Part 1 is the raw PageSpeed Insights
baseline, recorded verbatim so it can be compared against later runs. Part 2 is what has already
shipped. Part 3 is what remains.

---

# Part 1 — PageSpeed Insights baseline

**URL:** `https://resomix.com/`
**Captured:** Aug 3, 2026, 10:02:20 PM GMT+5
**Lighthouse:** 13.4.1 · HeadlessChromium 150.0.7871.186 · single page session · initial page load
**Mobile config:** Emulated Moto G Power, **Slow 4G throttling**
**Desktop config:** Emulated Desktop, custom throttling
**Field data (CrUX):** *No Data* — the site has no real-user measurements yet, so every number below
is lab-simulated.

## 1.1 Scores

| Category | Mobile | Desktop |
|---|---|---|
| **Performance** | **56** | **78** |
| Accessibility | 96 | 96 |
| Best Practices | 96 | 96 |
| SEO | **100** | **100** |
| Agentic Browsing | 2/3 | 2/3 |

## 1.2 Core metrics

| Metric | Mobile | Desktop |
|---|---|---|
| First Contentful Paint | **10.7 s** 🔴 | 0.6 s 🟢 |
| Largest Contentful Paint | **12.3 s** 🔴 | 2.2 s 🟠 |
| Total Blocking Time | 0 ms 🟢 | 110 ms 🟢 |
| Cumulative Layout Shift | 0 🟢 | 0.087 🟢 |
| Speed Index | **10.7 s** 🔴 | 2.9 s 🔴 |

**Total page weight: 1,872 KiB** (audit "Avoids enormous network payloads" — passing).

### Reading the shape of this

TBT is 0 ms on mobile and JS execution is 0.8 s with 1.5 s total main-thread work — all green.
**This is not a "too much JavaScript executing" problem.** It is a load-blocking problem: nothing
paints for ten seconds because the render path is waiting on network. The mobile→desktop gap (56 vs
78) on identical code confirms it is bandwidth-bound, not compute-bound.

## 1.3 Root cause #1 — Web fonts (~994 KiB, 8 files, all `.otf`/`.ttf`)

The network dependency tree names a font as the terminal node of the critical path on **both** form
factors.

| Font | Size | Mobile | Desktop |
|---|---|---|---|
| HelveticaNeueRoman.otf | 247.8 KiB | 1,109 ms | 3,710 ms |
| HelveticaNeueBold.otf | 240.7 KiB | 1,681 ms | 4,380 ms |
| HelveticaNeueLight.otf | 118.6 KiB | 1,660 ms | 4,348 ms |
| FiraCode-SemiBold.ttf | 84.1 KiB | 1,707 ms | 4,383 ms |
| **FiraCode-Medium.ttf** | 83.9 KiB | **1,766 ms** ← critical path | **4,403 ms** ← critical path |
| FiraCode-Regular.ttf | 83.8 KiB | 1,131 ms | 3,711 ms |
| FiraCode-Light.ttf | 83.5 KiB | 1,724 ms | 4,383 ms |
| benzin-bold.ttf | 51.6 KiB | 1,708 ms | 4,382 ms |
| **Total** | **~994 KiB** | | |

**Maximum critical path latency: 1,766 ms (mobile) / 4,403 ms (desktop).**

The chain is `HTML → index.css → 8 fonts`. The fonts cannot even be *discovered* until the CSS
parses. For scale, the JS entry chunk is 77 KiB and the CSS is 22.5 KiB — fonts are ~13× the
JavaScript.

Three separate reported symptoms trace back to this single cause:

- **Desktop LCP element** is `<h1 class="hm-benzin uppercase">HEAR THE INVISIBLE` with
  **element render delay 4,430 ms** and TTFB 0 ms. The hero is waiting on Benzin.
- **Mobile LCP element** is the beta banner paragraph
  (`<p class="text-[length:var(--px-11)] lg:text-[length:var(--px-9)] font-light font-fi…">`) with
  element render delay 2,500 ms — the hero has not rendered yet at that point.
- **Desktop CLS 0.087 is entirely font-swap reflow.** Culprit table:

  | Shift | Element | Attributed to |
  |---|---|---|
  | 0.059 | `div.mx-auto.text-[var(--color-text-secondary)].relative.z-30` (page shell / nav) | `/fonts/FiraCode-Medium.ttf` (Web font) |
  | 0.026 | `div.hm-hero-art` | benzin-bold.ttf, HelveticaNeueBold.otf, FiraCode-Light.ttf, HelveticaNeueLight.otf, FiraCode-SemiBold.ttf (Web font) |
  | 0.002 | remainder | |

### Build-side confirmation

Measured directly from `apps/landing/dist`:

- `dist/` total: **16 MB**
- `dist/fonts/`: **13 MB across 47 files — zero `.woff2`**
- **46 `@font-face` declarations** in `apps/landing/src/styles/fonts.css`:
  Montserrat (19), Helvetica_Neue (17), Fira Code (6), Auger Mono (6), Benzin (2),
  "Auger Mono TEST" (1)
- `font-display: swap` on all 46 — this is correct and the "Font display" audit **passes**
- **No `<link rel="preload">` for any font** in `apps/landing/index.html`

> Note: `du` sizes above are uncompressed on-disk; Lighthouse figures are transfer sizes. Fonts are
> already compressed formats, so the two are close for fonts but diverge for JS/CSS.

## 1.4 Root cause #2 — Third-party JavaScript exceeds first-party

| Party | Transfer | Main-thread (mobile) | Main-thread (desktop) | Unused |
|---|---|---|---|---|
| posthog.com | 182 KiB | 307 ms | 335 ms | 88.7 KiB |
| Google Tag Manager | 119 KiB | 68 ms | — | 63.0 KiB |
| Other Google APIs/SDKs (GSI) | 98 KiB | 19 ms | — | 71.7 KiB |
| **Total** | **~399 KiB** | **~394 ms** | | **223 KiB** |

First-party JS is 249 KiB. **Third-party is larger than the app itself.**

PostHog breakdown (mobile transfer / main-thread):

| Script | Size | Main thread | Cache TTL |
|---|---|---|---|
| `/static/array.js` | 76 KiB | 161 ms | 4 h |
| `/static/posthog-recorder.js?v=1.410.4` | 55 KiB | 129 ms | 4 h |
| `/static/surveys.js?v=1.410.4` | 33 KiB | 7 ms | 4 h |
| `/static/dead-clicks-autocapture.js?v=1.410.4` | 7 KiB | 2 ms | 4 h |
| `/static/exception-autocapture.js?v=1.410.4` | 5 KiB | 3 ms | 4 h |
| `/static/web-vitals.js?v=1.410.4` | 3 KiB | 4 ms | 4 h |
| `…phc_7Dd3e…/config.js` | 1 KiB | 1 ms | 5 m |

Google Tag Manager: `/gtm.js?id=GTM-PD9XQZRV` — 119 KiB / 68 ms.
Google GSI (One Tap): `/gsi/client` 97 KiB / 19 ms, `/gsi/style` 1 KiB.

PostHog is additionally responsible for **100 % of** three separate audits:

- **Use efficient cache lifetimes — est. savings 123 KiB.** 181 KiB of PostHog assets on a 4-hour TTL.
- **Legacy JavaScript — est. savings 44 KiB** (43.6 KiB all PostHog):
  | Script | Wasted | Polyfill |
  |---|---|---|
  | `web-vitals.js` | 15.4 KiB | `Array.prototype.at` (`array-at-polyfill.mjs:1:52`) |
  | `posthog-recorder.js` | 11.0 KiB | `Array.from` (`rrweb-record.js:1:0`) |
  | `surveys.js` | 8.8 KiB | `Math.trunc` (`uuidv7.mjs:12:21`) |
  | `array.js` | 8.4 KiB | `Math.trunc` (`uuidv7.mjs:12:21`) |
- **Duplicated JavaScript — est. savings 8 KiB** (`fflate`, `autocapture-utils.mjs`, `uuidv7.mjs`,
  `error-properties-builder.mjs`, `user-agent-utils.mjs`, `gzip.mjs`, `preact.module.js`).

**No origins are preconnected.** Lighthouse's own candidates:

| Origin | Est. LCP saving (mobile) | Est. LCP saving (desktop) |
|---|---|---|
| `https://eu.i.posthog.com` | 370 ms | 150 ms |
| `https://bserver.resomix.com` | 320 ms | — |
| `https://accounts.google.com` | — | 80 ms |

## 1.5 Root cause #3 — Unused first-party JavaScript

**Reduce unused JavaScript — est. savings 399 KiB total.**

| File | Transfer | Unused | % |
|---|---|---|---|
| `/assets/vendor-f9M9xD2Z.js` | 188.6 KiB | **153.2 KiB** | **81 %** |
| `/assets/react-C3bUCrXl.js` | 60.4 KiB | 22.1 KiB | 37 % |
| *(1st-party subtotal)* | 249.0 KiB | 175.3 KiB | |
| posthog.com | 161.1 KiB | 88.7 KiB | |
| GSI `/gsi/client` | 95.8 KiB | 71.7 KiB | |
| GTM `/gtm.js` | 118.1 KiB | 63.0 KiB | |

Vendor chunk contents (verified): **i18next, axios, zustand**.
`three` / `@react-three/fiber` are **not** in the landing bundle — the `manualChunks` rules naming
them in `vite.config.ts` are defensive only.

Largest built chunks (on-disk, uncompressed):

| JS | Size | | CSS | Size |
|---|---|---|---|---|
| `vendor-*.js` | 596 K | | `index-*.css` | 92 K |
| `index-*.js` | 236 K | | `SonicDiscoveryPage-*.css` | 40 K |
| `react-*.js` | 188 K | | `HomePage-*.css` | 32 K |
| `ProductPage-*.js` | 76 K | | `DevelopersPage-*.css` | 28 K |
| `resomix-ui-*.js` | 68 K | | `PartnersPilotPage-*.css` | 24 K |
| `CatalogueIntelligencePage-*.js` | 68 K | | | |
| `AboutPage-*.js` | 64 K | | | |
| `SonicDiscoveryPage-*.js` | 60 K | | | |

## 1.6 Render-blocking requests

| | Mobile | Desktop |
|---|---|---|
| **Est. savings** | **4,990 ms** | *(not scored)* |
| resomix.com total | 22.5 KiB / 810 ms | 22.6 KiB / 160 ms |
| `/assets/index-D0FCgxEq.css` | 17.5 KiB / 650 ms | 17.5 KiB / 160 ms |
| `/assets/resomix-ui-CDeEUvgT.css` | 5.0 KiB / 160 ms | 5.0 KiB |

## 1.7 Smaller findings

- **Improve image delivery — est. savings 40 KiB.**
  `/assets/void-grai….png` — 45.6 KiB resource, **39.6 KiB saveable**.
  Element: `div.hm-layer.hm-layer-grain` (the void-field grain texture).
  Recommendation given: modern format (WebP/AVIF) or stronger compression.
- **Minify JavaScript — est. savings 5 KiB.**
  `/scripts/resomix-consent.js` — 11.9 KiB shipped **unminified**, 5.3 KiB saveable.
  (It lives in `public/scripts/`, so Vite never processes it.)
- **Forced reflow — 83 ms.**
  Top function call: `/assets/vendor-f9M9xD2Z.js:2:1408`
  Source: `/assets/index-B7xj91uA.js:2:32159`
- **Avoid non-composited animations — 1 element.**
  `section#hm-hero > div.hm-hero-art > svg.hm-sl > path.hm-dashflow`
  `<path class="hm-dashflow" d="M40 250 V430" vector-effect="non-scaling-stroke" style="color: rgba(238, 74, 38, 0.75); stroke-width: 1.5;">`
  Unsupported CSS property: **`stroke-dashoffset`** (animation name `hm-dash`).
- **Avoid long main-thread tasks — 4 long tasks.**
  | Source | Duration | Start |
  |---|---|---|
  | `posthog-recorder.js` | 139 ms | 5,586 ms |
  | `vendor-f9M9xD2Z.js` | 76 ms | 6,059 ms |
  | `vendor-f9M9xD2Z.js` | 52 ms | 5,372 ms |
  | `gtm.js` | 52 ms | 2,886 ms |
- **Optimize DOM size** (informational, not failing).
  Total elements **1,603**; DOM depth **19** (`svg.hm-sl > defs > lineargradient#hm-tgrad > stop`);
  most children **19** (`div.hm-frame > div.hm-cat-grid > figure.hm-cat-map > svg.hm-sl`).

## 1.8 Performance — passed audits (13)

Layout shift culprits · Document request latency · **Font display** · INP breakdown (n/a) ·
LCP request discovery (n/a) · Optimize viewport for mobile · **Minify CSS** · **Reduce unused CSS** ·
Avoids enormous network payloads (1,872 KiB) · User Timing marks (n/a) ·
**JavaScript execution time — 0.8 s** · **Minimizes main-thread work — 1.5 s** ·
**Image elements have explicit `width` and `height`**

## 1.9 Accessibility — 96

22 passed · 10 manual checks · 40 not applicable. No failing automated audits.

Passed includes: `aria-*` match roles · `aria-hidden` not on `<body>` · roles have required `aria-*` ·
role values valid · `aria-*` valid values · `aria-*` not misspelled · buttons have accessible name ·
`user-scalable="no"` not used · ARIA used as specified · `aria-hidden` has no focusable descendants ·
only permitted ARIA attributes · **background/foreground contrast sufficient** · `<title>` element ·
`<html lang>` present and valid · links distinguishable without colour · links have discernible name ·
lists contain only `<li>` · `<li>` inside `<ul>/<ol>/<menu>` · headings sequentially descending ·
document has a main landmark · no deprecated ARIA roles.

## 1.10 Best Practices — 96

**Failing:**

1. **Touch targets do not have sufficient size or spacing.**
   Failing elements are the footer legal/support links:
   - `legal.info()` → `id="footer-legal-link"` → `https://legal.resomix.com`
   - `support.to()` → `id="footer-support-link"` → `https://support.resomix.com`
2. **Browser errors were logged to the console.**
   - `posthog.com` — API errors: `{object 0}`
   - `resomix.com` — `…authRefresh 1.0` → **401 Unauthorized** from `beta.resomix.com`
     (the landing page calls the auth refresh endpoint for anonymous visitors)
   - `The fetch of the config file resulted in a network error: ERR_NAME_NOT_RESOLVED`
   - `The provider's fetch config file fetch resulted in an error response code`
3. **Missing source maps for large first-party JavaScript.**
   `vendor-*.js` has no source map — `sourcemap: false` in `apps/landing/vite.config.ts`.
   (PostHog's static files are also listed.)

**Informational (unscored) — Trust and Safety:** CSP effective against XSS · strong HSTS policy ·
origin isolation with COOP · clickjacking mitigation via XFO or CSP · DOM-based XSS mitigation via
Trusted Types. **None of these are currently configured.**

**Passed (11):** Uses HTTPS · avoids deprecated APIs · avoids third-party cookies · allows paste into
inputs · no geolocation prompt on load · no notification prompt on load · images with correct aspect
ratio · images at appropriate resolution · HTML doctype · charset defined · no Issues-panel issues.

## 1.11 SEO — 100

All 9 audits pass: page isn't blocked from indexing · has a `<title>` · has a meta description ·
successful HTTP status · links have descriptive text · links are crawlable · `robots.txt` is valid ·
valid `hreflang` · valid `rel=canonical`.

Manual check offered: "Structured data is valid" (unscored — run the Rich Results test).

## 1.12 Agentic Browsing — 2/3

**Failing: `llms.txt` does not follow recommendations.**
- *File is missing a required H1 header (e.g. `# Title`)*
- *File does not appear to contain any links*

**Cause:** `/llms.txt` **does not exist**. Cloudflare Pages' SPA fallback returns `index.html` with a
**200**, so Lighthouse received HTML and tried to parse it as Markdown. This soft-404 behaviour
affects **every** non-existent file path, not just this one.

**Passed (2):** Accessibility tree is well-formed · Cumulative Layout Shift.
**Not applicable (3):** WebMCP form coverage · WebMCP tools registered · WebMCP schemas valid.

---

# Part 2 — Work completed

Everything below is already shipped and covered by tests.

## 2.1 SEO infrastructure

### Single source of truth per app

`apps/landing/src/routes/seoConfig.ts` (22 routes) and `apps/webapp/src/routes/seoConfig.ts`
(19 routes) hold title / description / changefreq / priority / `noindex` / canonical override.
**Both the document head and the sitemap derive from this file**, so they cannot drift apart.

### What it replaced

- **Sitemap was hand-maintained and badly stale.** `public/sitemap.xml` advertised `/terms` and
  `/privacy` — never routes — while listing **one** of the seventeen marketing pages.
- **Titles were set ad hoc** by a `document.title` effect in **16 separate page components**; the
  other four had none and inherited whatever the previous page left behind.
- **`index.html` hardcoded `<link rel="canonical" href="https://resomix.com/">`**, which every route
  inherited — all twenty URLs declared themselves to be the homepage.

### Components

| File | Role |
|---|---|
| `packages/hooks/src/Seo/useDocumentMeta.ts` | Shared head writer (title, description, canonical, robots, OG, Twitter). One implementation, both apps. |
| `apps/landing/src/components/RouteMeta.tsx` | Landing: reads route → applies metadata. Mounted once next to `<Routes>`. |
| `apps/webapp/src/components/RouteMeta.tsx` | Webapp equivalent, honours cross-origin canonical overrides. |
| `tooling/prerenderHead.ts` | Build plugin — emits one HTML file per route with the head baked in. Shared by both apps. |

### Metadata quality rules (enforced by tests)

- Every route has an entry; every entry maps to a real route
- Titles unique and ≤ 60 chars (max is 58) — 8 were tightened
- Descriptions unique, 50–160 chars — 1 was shortened, 1 lengthened
- Unknown paths get `noindex, follow` and the 404 title
- Trailing slashes collapse (`/trust/` → `/trust`)

## 2.2 Generated sitemaps

Both apps generate `dist/sitemap.xml` at build time via a Vite plugin reading `seoConfig`.
`public/sitemap.xml` is deleted in both, and a test fails if it reappears.

- **Landing: 20 indexed URLs** of 22 routes (`/error` and `/404` excluded as `noindex`).
- **Webapp: 3 indexed URLs** of 19 — `/`, `/sonic-discovery`, `/analysis`.

Verified: zero dead URLs; every excluded route is a redirect, a beta hand-off, or `noindex`.

## 2.3 Static head prerendering

**Problem:** link previews on WhatsApp, Slack, iMessage, LinkedIn and Upwork showed the homepage for
every URL. This is an SPA — every URL served the same `index.html`, and `RouteMeta` only rewrites the
head after React boots. Those scrapers **do not execute JavaScript**; they read the bytes the server
returned. Runtime head management cannot reach them by construction. (Googlebot renders JS, so search
was unaffected.)

**Fix:** the build emits `dist/<route>/index.html` per route with the head already correct.
Cloudflare Pages serves a directory's `index.html` for that path.

- Landing: **21 HTML files** · Webapp: **18 HTML files**
- Head-only prerendering — the body is still client-rendered, which is all a preview needs
- Verified: body below `<head>` is byte-identical to the shell; asset URLs stay absolute (a relative
  path would make nested pages request `/solutions/producers/assets/…` and fail to boot)
- `&` is escaped in attributes (e.g. "Trust, Rights &amp; Security")

**After each deploy**, already-shared links sit in scraper caches. Force a re-scrape:
[Facebook debugger](https://developers.facebook.com/tools/debug/) (also drives WhatsApp) and
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). Slack and iMessage refresh on
their own.

## 2.4 Crawl posture

### Landing
`robots.txt` allows all; `_headers` sets `immutable` on `/assets/*` and `/fonts/*`, and
`must-revalidate` on HTML. `index.html` carries OG/Twitter defaults plus JSON-LD
`Organization` + `WebSite`. Favicon `type` corrected (declared `image/svg+xml`, was a PNG).

### Webapp — was self-contradictory, now consistent

| | Before | After |
|---|---|---|
| `index.html` | `noindex, nofollow` | `index, follow` |
| `robots.txt` | `Disallow: /*/` blocked every subpage | allows crawl; per-page `noindex` does the work |
| sitemap | 4 hand-written URLs, all blocked | generated, 3 real pages |

`nofollow` removed entirely — it stranded link equity for no benefit.

**Crawlable but `noindex`:** `/library`, `/profile`, `/sessions`, `/change-password`, all six
`/auth/*` screens, `/error`, `/loader`, `/playlist`. Deliberately not robots-blocked: a blocked page
is never fetched, so its `noindex` is never read.

**Cross-origin canonicals:** `/subscribe` and `/contact` render the *same shared components* as the
marketing site. Both canonicalise to `resomix.com` and are excluded from beta's sitemap. They stay
`index, follow` on purpose — `noindex` + `canonical` is a contradictory pair.

The canonical also drops the query string, collapsing the effectively-infinite
`/sonic-discovery?id=…` playlist URLs onto one page.

### Embed
Stays `noindex, follow` (correct for a widget). `og:image` was relative `/logo.png` — scrapers do not
resolve relative URLs, so shared embeds previewed with no image. Now absolute, plus `twitter:image`.

JSON-LD `WebApplication` added to the webapp.

## 2.5 Navigation stability (shipped alongside)

Not SEO, but the same release. Symptom: navigation silently failed **after a deploy but never
locally** — clicking a nav item did nothing.

**Cause:** every page is a hash-named chunk. A tab open across a deploy requests the old filename →
404 → the `import()` rejects → **no ErrorBoundary existed anywhere in the landing app** → nothing
rendered. `React.lazy` memoises the rejection, so that route stayed dead for the session.

| File | Role |
|---|---|
| `apps/landing/src/routes/lazyRoute.ts` | Retries once, then treats a second failure as a stale document and reloads. One reload per session, re-armed after any success — a broken build cannot become a reload loop. |
| `apps/landing/src/components/RouteErrorBoundary.tsx` | Actionable error screen instead of a blank one; clears on navigation. |
| `apps/landing/src/components/RouteFallback.tsx` | Replaces `<Suspense fallback={null}>`, which rendered a blank document during chunk download. |
| `apps/landing/src/routes/pageLoaders.ts` | Central route→chunk map + `prefetchRoute` on hover/focus/touch. |

Also: navigation runs inside `startTransition` (keeps the current page on screen while the next chunk
loads; discards superseded transitions on fast clicks), a 2px top progress bar, and a fix for the
mega menu calling `preventDefault()` unconditionally — ⌘-click and middle-click were being swallowed.

**Note:** navigating beta → landing is a full document load (`window.location.href`), so it was never
exposed to the stale-chunk failure.

## 2.6 Design-system work (same release)

- **Beta banner stacking.** The notice rendered grey or invisible on marketing pages. Cause was not
  colour: the page shell is `relative z-30` (a stacking context) and pages hang a
  `position: fixed; inset: 0` void-field backdrop inside it, so it painted over a `z-10` banner.
  Both banners are now `relative z-40`. `AuthStatusBanner`'s `z-10` was also inert — it sat on a
  statically positioned box.
- **Canonical hero scale.** All 17 heroes now use 32 / 36 / 48 px at weight 900 (taken from
  `/product/catalog-intelligence`), and `44/52` block padding via an `rx-hero-pad` hook. Previously
  desktop sizes ranged 46–76 px and four heroes declared **no weight at all** (they inherited
  `font-light`; it only looked right because Benzin ships a single 700 face).
- **Hero accent emphasis.** `[[double brackets]]` in the translation string, rendered by
  `HeroTitle`. Was 6 of 17 heroes; now all 17. Moving the accent is a copy edit, not a code change.
- **`/pricing` removed**, consolidated onto `/subscribe` (they rendered the identical component).
  `/pricing` remains as a `<Navigate replace>` so existing links don't 404.
- **`/subscribe` restyled** to the marketing system (square hairline panels, mono eyebrows, Benzin
  headline, notched accent button) — replacing 10px radii, `backdrop-blur`, `rounded-full` pills and
  dotted slate borders. Billing logic untouched. Note this page is shared, so beta's `/subscribe`
  changed too.
- **Backend:** `PUBLIC_PLAN_CODES` whitelist in `billing_service.py` so stray DB plan rows (e.g. a
  hand-made `temp` plan) can no longer appear on the public pricing page.

## 2.7 Test coverage added

| Suite | Covers |
|---|---|
| `routeSeo.spec.tsx` (landing, webapp) | route↔config parity, title/description limits, canonical rules, RouteMeta output |
| `prerenderedHead.spec.ts` (landing, webapp) | asserts against real build output — per-route head, absolute assets, escaping |
| `routeChunkRecovery.spec.tsx` | retry, one-shot reload, re-arm, no reload loop |
| `bannerStacking.spec.tsx` | banner z-index beats the page shell, stays below drawer/modals |
| `heroTitleScale.spec.ts`, `heroTitleEmphasis.spec.tsx` | canonical ramp, no off-scale sizes, accent markers |
| `pricingRedirect.spec.tsx`, `pricingDesignSystem.spec.tsx` | redirect survives, design-system tells removed |

**Landing 224 passing · Webapp 161 passing · all four apps build clean.**

---

## 2.8 Font delivery — rebuilt (fixes root cause #1)

`tooling/buildFonts.py` regenerates every face as **two subset `.woff2` files with a
`unicode-range`**, so a page downloads only the coverage it uses:

| | latin | ext |
|---|---|---|
| Covers | Latin + punctuation, super/subscripts, currency, letterlike, number forms, arrows, maths, misc-technical, box-drawing, geometric shapes, misc symbols, dingbats | Greek + Cyrillic |
| Fetched | always | only when such text is present |

**Homepage critical faces: 994 KiB → 333 KiB (67% smaller).**
**Deployed font directory: 12 MB → 1.7 MB per app.**

| Face | Was (wire) | Now (latin) |
|---|---|---|
| HelveticaNeueRoman | 247.8 KiB | 72.8 KiB |
| HelveticaNeueBold | 240.7 KiB | ~69 KiB |
| HelveticaNeueLight | 118.6 KiB | ~48 KiB |
| FiraCode ×4 | 335.3 KiB | ~127 KiB |
| benzin-bold | 51.6 KiB | 22.6 KiB |

Decisions and the reasoning behind them:

- **woff2 alone was only 21%** on the wire (994 → 781 KiB) because Cloudflare already gzips `.otf`.
  The real lever was glyph coverage: each Helvetica Neue face carried ~2,200 codepoints including
  **Georgian and Cherokee**. Subsetting is what produced the win.
- **Greek and Cyrillic kept**, split into `.ext` — the team is in Thessaloniki and the catalogue
  carries international artist names. They cost nothing on an English page.
- **Subset range verified against real content** before committing: every non-ASCII character in the
  locale file and all TSX was checked. That caught `⌘`, `─` and `═`, which an ordinary Latin subset
  would have dropped. (`💪` is dropped, but it was never in the font — no regression.)
- **Montserrat deleted** — 18 faces, 4.6 MB, referenced by nothing.
- **Auger Mono kept** despite appearing unused: `.font-auger` is used by
  `packages/ui/src/Elements/SearchDropdown.tsx`. Nearly deleted it.
- **Sources moved to `/fonts-src`** (not deployed). Only generated `.woff2` ships.
- **Preloads: 3, not 11.** The webapp preloaded eleven `.otf`/`.ttf` files — all of which this change
  made dangling, and preloading everything only front-loads the same bytes. Now Benzin 700 (the
  hero `<h1>`, the desktop LCP element), Helvetica 300 (body) and Fira Code 500 (nav, the largest
  single CLS culprit at 0.059), each as the latin subset. This also breaks the
  `CSS → font` discovery chain that put a font at the end of the critical path.
- `font-display: swap` retained on every face.

Guarded by `fontDelivery.spec.ts` (28 tests): no dangling `url()`, no unreferenced files, woff2
only, every face split, preloads resolve and are declared, Montserrat stays gone, Auger stays.

## 2.9 Edge routing — real 404s (fixes the soft-404)

Cloudflare Pages served `index.html` with a **200** for every unmatched path. `dist/404.html` is now
emitted, which switches Pages to a genuine 404.

That cuts both ways: **any path without a file is now a 404**, so every live route must have one.
Handled by:

- All 22 SEO routes → prerendered already.
- `extraRoutes` in the prerender plugin → shells for `/pricing`,
  `/product/catalogue-intelligence`, `/profile`, `/sessions`, `/change-password` (two redirects,
  three beta hand-offs). `noindex`, but titled with the site default — calling them "Page not found"
  would tell a scraper something untrue.
- `/auth/*` is a wildcard (emailed verify/reset links) so it cannot be a static file →
  `public/_redirects` rewrites it to the shell with a **200**. Scoped to `/auth/` only, so it cannot
  shadow a prerendered page.

**26 route shells + 404.html** on landing; **18 + 404.html** on the webapp.

A real `public/llms.txt` was also added — Markdown, `# Resomix` H1, and links to every live route,
which is what the Agentic Browsing audit asked for. It previously resolved to the SPA shell.

Guarded by `edgeRouting.spec.ts` (11 tests), which reads the route table from `App.tsx` so it fails
if a new route ships without a shell — the failure mode that would otherwise 404 real pages in
production.

## 2.10 Bundle: the vendor chunk (fixes root cause #3)

Lighthouse reported `vendor-*.js` at 188.6 KiB transfer with **153.2 KiB unused (81 %)**. Attributing
it with the newly-enabled source maps showed why:

| Package | Share of vendor |
|---|---|
| **hls.js** | **67.1 %** (1,268 K pre-minify) |
| @remix-run/router | 10.2 % |
| howler | 5.6 % |
| axios | 5.4 % |
| i18next | 4.1 % |
| jsmediatags | 2.7 % |

The marketing site was shipping the **entire audio stack** — HLS streaming, Howler, ID3 tag parsing —
on a page with no player. It arrived through the `@resomix/hooks` barrel: landing imports five hooks
from it, and because **no workspace package declared `sideEffects`**, Rollup had to assume every
re-exported module might have side effects and could not drop any of them.

Fix: `"sideEffects": ["*.css"]` on all five packages. The `*.css` form is deliberate — `packages/ui`
has two real stylesheet imports (`design-system/index.ts`, `ContourSphere.tsx`) that a blanket
`false` would have silently dropped.

**vendor: 588 K → 95 K raw.** Verified `hls.js`, `howler` and `jsmediatags` are absent from every
landing chunk, and that the webapp still bundles the ones it uses. `howler` dropped from the webapp
too — correct, because its only consumer is `PlayerPage`, whose route is commented out in `App.tsx`.

## 2.11 Bundle: locale splitting

`locales/en/common.json` was 204 KiB (**56.5 KiB gzipped**), statically imported by `i18n.ts`, so
every visitor downloaded the copy for all twenty pages to read one.

The 20 top-level namespaces map 1:1 onto pages, and a scan confirmed **no section referenced another
section's namespace** — so the split was safe:

- `locales/en/core.json` — `nav`, `general`, `waitlist` (7.1 K raw / **2.5 K gzipped**), loaded eagerly
- `locales/en/pages/<ns>.json` × 17 — fetched by `pageLoaders.ts` **alongside the route chunk**

Both promises are awaited together and `addResourceBundle` runs before the module resolves, so React
can never mount a component whose strings are missing — that would render a raw `about.hero.title`
for a frame.

`i18next-browser-languagedetector` was removed with it: there is one locale and no language
switching, so detection could only ever resolve to `en`. `lng: 'en'` is now explicit, which is also
more predictable — detection read localStorage and could be influenced by another app on the origin.

**Entry chunk: 236 K → 72 K raw.**

## 2.12 Third-party staging

| When | What |
|---|---|
| eager | Silktide consent banner — functional, and it gates the rest |
| idle | Google One Tap (98 KiB) — user-facing, so it goes first |
| idle + 1.5 s | Google Tag Manager (119 KiB) → PostHog (182 KiB, 7 scripts) |

**PostHog is not a dependency of this repo.** No package, no init code — the GTM container loads it.
So PostHog can never start before GTM, and deferring GTM defers both: ~301 KiB and ~375 ms of
main-thread work off the critical path.

Kept in `<head>`, inline and synchronous: the `gtag('consent','default',{…denied})` snippet, which
Consent Mode v2 requires to run before the container, and the `<noscript>` iframe. On beta's
`/auth/*` routes One Tap stays immediate — signing in is the point of those pages.

**Caching note:** these are per-document, not per-page. SPA navigation does not re-fetch them; a
reload re-uses the browser cache subject to each vendor's TTL (PostHog's is 4 h, set by their CDN and
not something we control). The cost is a first-visit cost, which is what deferring addresses.

## 2.13 Security headers

Previously **none** were set. Now on both apps:

`Strict-Transport-Security` (2 y, includeSubDomains, preload) · `X-Content-Type-Options: nosniff` ·
`X-Frame-Options: SAMEORIGIN` · `Referrer-Policy: strict-origin-when-cross-origin` ·
`Permissions-Policy` (camera, mic, geolocation, payment, USB, magnetometer all denied) ·
`Cross-Origin-Opener-Policy: same-origin-allow-popups`

COEP is deliberately omitted — it would break third-party embeds and images that do not send CORP.

**The CSP ships as `Content-Security-Policy-Report-Only`.** It has to cover GTM plus whatever GTM
injects, and an enforced CSP that is slightly wrong is an outage. Watch the console on production,
add anything legitimate that trips, then rename the header to enforce.

`apps/embed` is deliberately excluded from the frame rules — being iframed elsewhere is its purpose.

## 2.14 Social card

A real **1200×630** `og-cover.png`, generated in the brand fonts (Benzin headline, accent split,
Helvetica sub, Fira footer) and wired into both apps' `seoConfig` and static defaults. Previously the
399×399 logo, which every platform cropped to a small square.

## 2.15 Smaller items

- **void-grain tile → lossless WebP** — 45.6 K → 24.1 K (noise defeats lossy; lossless matched it).
  16 importers updated.
- **`public/scripts/` minified at build** (`tooling/minifyPublicScripts.ts`) — `resomix-consent.js`
  50.8 K → 23.2 K raw, 11.9 → 6.6 K gzipped; its CSS 11.5 → 8.1 K. Source stays readable; Vite does
  not process `public/`.
- **4 preconnect hints** — none existed. Lighthouse estimated 370 ms (PostHog) + 320 ms (API).
- **Production source maps** enabled on both apps — separate `.map` files, fetched only with DevTools
  open. This is also what made the vendor attribution above possible.
- **Footer touch targets** — the legal/support links had ~16 px tap areas stacked flush; now ≥24 px
  with spacing.
- **Anonymous 401 silenced.** `useAuthInit` attempts a refresh on first load even without a local
  token, because the cookie is scoped to `.resomix.com` and may carry a beta session. With no cookie
  the server correctly answers 401 — expected, not an error. It is no longer logged; anything other
  than a 401 still is.
- **Edge 301s** for `/pricing` → `/subscribe` and the catalogue spelling. Both were client-side
  `<Navigate replace>` only, so crawlers saw two 200s and no redirect signal.
- **IndexNow key file** at `public/<key>.txt`. Nothing pings automatically — see the README beside it.

## 2.16 Copy applied from SEO_METADATA_ALL_PAGES.md

Per George: that document is authoritative for titles, descriptions and H1s; the `.docx` is for
advice and implementation flow only.

- **Titles + descriptions** — 19 landing routes, plus `/subscribe` and `/contact` on beta (they
  canonicalise to landing, so they must match). Max title 59, max description 159.
- **All 17 H1s**, each with a `[[…]]` accent phrase.
- **Hero systems unified** — seven heroes still used `h1Lead`/`h1Em` pairs that pinned the accent to
  a fixed position; all 17 now use the inline marker, so moving emphasis is a copy edit. 16 dead
  locale keys removed.

One entry needed interpretation: `/product/sonic-discovery`'s H1 field is not copy — it reads
*"SONIC DISCOVERY — approved live hero line"*, i.e. "keep what's live". But the doc moves that live
line ("Drop one track. Find what belongs next.") to the homepage, which would have put an identical
H1 on two pages. It now reads **"Find similar tracks by sound."**, taken from that page's own doc
title and stated intent.

# Part 3 — Open items

Ordered roughly by payoff. **None of these have been done.**

## 3.1 Fonts — DONE, see 2.8

Re-run PageSpeed after deploying to confirm the expected movement in mobile FCP/LCP/SI and the
elimination of the desktop CLS (0.087), since every layout-shift culprit was a web font.

## 3.2 Third-party loading strategy — DONE, see 2.12

- Defer or gate **PostHog** (182 KiB, 7 scripts, ~307 ms main thread). Consider loading after
  interaction/idle, or dropping `posthog-recorder` (session replay, 55 KiB / the single longest
  task) on marketing pages.
- Defer **GTM** (119 KiB) similarly.
- Load **Google GSI / One Tap** (98 KiB) lazily — it is only needed for signed-out sign-in intent.
- Add `<link rel="preconnect">` for `eu.i.posthog.com` and `bserver.resomix.com` (mobile) /
  `accounts.google.com` (desktop). Lighthouse estimates 370 + 320 ms.

## 3.3 First-party JS — DONE, see 2.10 / 2.11

- **`vendor` chunk is 81 % unused** (153.2 KiB wasted). Investigate i18next (only an `en` locale
  exists) and axios (replaceable with `fetch`).
- Enable `sourcemap: true` for production, or upload maps separately, to clear the Best Practices
  audit and make prod debugging possible.

## 3.4 Quick wins — DONE, see 2.15

- Convert `void-grain.png` (45.6 KiB) to WebP/AVIF — 39.6 KiB.
- Minify `public/scripts/resomix-consent.js` — 5.3 KiB.
- Fix footer touch targets (`#footer-legal-link`, `#footer-support-link`) — larger hit area/spacing.
- Silence the anonymous-visitor **401** from `authRefresh` and the `ERR_NAME_NOT_RESOLVED` config
  fetch, both of which log console errors.
- Replace the `stroke-dashoffset` animation on `path.hm-dashflow` with a compositable property.
- ~~Add a real `/llms.txt`, and a proper 404~~ — DONE, see 2.9.

## 3.5 Still outstanding

- ~~1200×630 OG image~~ — DONE, see 2.14.
- ~~Security headers~~ — DONE, see 2.13. **CSP is Report-Only; enforcing it is a deliberate follow-up.**
- **Submit sitemaps** to Google Search Console and Bing Webmaster Tools, and wire the IndexNow ping
  into the deploy. Cannot be done from here — needs those accounts.
- **Re-run PageSpeed** after deploying. Everything above is measured from the build; the score is not.
- **Descriptive link anchors** — checked, nothing to do: there are no generic "Learn more"/"Click
  here" anchors, and Lighthouse's "Links have descriptive text" audit already passes.
- **`llms.txt` / `stroke-dashoffset`** — the animation is left alone deliberately: it cannot be
  composited without changing the hero visual, it is already gated behind the in-view class, and TBT
  is 0 ms.
- **Naming mismatch on `/subscribe`** — the page titles itself "Pricing" while living at
  `/subscribe`. It *is* in the sitemap and indexed correctly; this is only a naming decision, not a
  defect.
