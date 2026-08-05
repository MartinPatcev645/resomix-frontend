# Structured Data — Plan

Agreed scope for JSON-LD across `resomix.com` and `beta.resomix.com`, combining George's
recommendations with what the codebase can actually substantiate.

**Governing rule (Google):** use JSON-LD, and only describe content that is **visible on the page and
factual**. Structured data that describes something a visitor cannot see, or that asserts something
unverifiable, is a manual-action risk — not just wasted effort.

**Second rule, ours:** it is emitted at **build time into the static HTML**. No major AI crawler
executes JavaScript (Vercel's analysis of 500M+ GPTBot fetches found zero JS execution; as of June
2026 none of GPTBot, ClaudeBot, PerplexityBot, Bytespider or Meta render it). Runtime-injected JSON-LD
is invisible to exactly the consumers that lean hardest on structured data.

---

## 1. What already ships

| Scope | Types | Where |
|---|---|---|
| Landing, site-wide | `Organization`, `WebSite` | `apps/landing/index.html` |
| Landing, per route | `WebPage`, `BreadcrumbList` (+ `isPartOf`, `about`, `inLanguage`) | `tooling/prerenderHead.ts` |
| Webapp, site-wide | `Organization`, `WebApplication` | `apps/webapp/index.html` |

`WebPage` carries the route's own `name` and `description` from `seoConfig.ts`, so it cannot drift
from the `<title>`/`<meta description>`.

---

## 2. To add — site-wide `Organization`

Enrich the existing node. Every field below is verifiable today.

```jsonc
{
  "@type": "Organization",
  "@id": "https://resomix.com/#organization",
  "name": "Resomix",
  "url": "https://resomix.com/",
  "logo": "https://resomix.com/og-cover.png",
  "description": "Sonic intelligence platform for discovering, analysing and indexing music by sound.",

  // NEW — four verified official profiles, already in packages/config
  "sameAs": [
    "https://www.facebook.com/resomixofc",
    "https://www.instagram.com/resomixofc",
    "https://x.com/Resomixofc",
    "https://soundcloud.com/resomixofc"
  ],

  // NEW — real, monitored routes; four distinct purposes, so four typed points
  "contactPoint": [
    { "@type": "ContactPoint", "contactType": "customer support",  "email": "support@resomix.com",  "availableLanguage": "en" },
    { "@type": "ContactPoint", "contactType": "sales",             "email": "partners@resomix.com", "availableLanguage": "en" },
    { "@type": "ContactPoint", "contactType": "legal",             "email": "legal@resomix.com",    "availableLanguage": "en" },
    { "@type": "ContactPoint", "contactType": "privacy",           "email": "privacy@resomix.com",  "availableLanguage": "en" }
  ],

  // NEW — already stated publicly on /about, so visible-and-factual
  "foundingLocation": {
    "@type": "Place",
    "address": { "@type": "PostalAddress", "addressLocality": "Thessaloniki", "addressCountry": "GR" }
  }
}
```

**Source the `sameAs` array from `packages/config`** (`FACEBOOK_URL`, `INSTAGRAM_URL`,
`TWITTER_URL`, `SOUNDCLOUD_URL`) rather than hardcoding it, and **filter empty strings** — the config
defaults each to `''`, and an empty `sameAs` entry is invalid.

> **Why `sameAs` was initially deferred:** an earlier audit looked for literal URLs in the source and
> found none, because they are injected from env. They exist and are verified. The underlying caution
> still stands for anything added later — an unverified `sameAs` can merge this entity with someone
> else's in the Knowledge Graph, which is far harder to undo than to avoid.

**`foundingLocation` is a business decision, not a technical one.** It publicly ties the company to
Thessaloniki. `/about` already says so, so this asserts nothing new — but if that should change,
drop the field.

---

## 3. To add — internal pages

Extend the existing per-route node with `mainEntity`, pointing at the thing the page is about.

```jsonc
{
  "@type": "WebPage",
  "@id": "https://resomix.com/partners#webpage",
  "name": "...", "description": "...",
  "isPartOf": { "@id": "https://resomix.com/#website" },   // already shipping
  "about":    { "@id": "https://resomix.com/#organization" }, // already shipping
  "mainEntity": { "@id": "https://resomix.com/partners#service" }  // NEW
}
```

`BreadcrumbList` already ships on every nested route and needs no change.

---

## 4. To add — page-type entities

### `Service` — partner and solutions pages

Nine routes: `/partners`, `/partners/pilot`, and the seven `/solutions/*`.

```jsonc
{
  "@type": "Service",
  "@id": "https://resomix.com/partners#service",
  "name": "Catalogue Intelligence for partners",
  "description": "…",                     // reuse the route description from seoConfig
  "provider": { "@id": "https://resomix.com/#organization" },
  "serviceType": "Music catalogue similarity indexing",
  "areaServed": "Worldwide"
}
```

No `offers` and no `aggregateRating` — see §5.

### `WebAPI` — `/developers`

```jsonc
{
  "@type": "WebAPI",
  "@id": "https://resomix.com/developers#api",
  "name": "Resomix API",
  "description": "…",
  "provider": { "@id": "https://resomix.com/#organization" },
  "documentation": "https://resomix.com/developers"
}
```

Accurate, and produces **no Google rich result** — include it for AI/LLM consumers and semantic
correctness, not for SERP appearance. Set expectations accordingly.

### `SoftwareApplication` — only where software actually is

Already covered: `beta.resomix.com` declares `WebApplication`. Nothing to add.

---

## 5. Deliberately NOT doing

| Not doing | Why |
|---|---|
| `SoftwareApplication` on `/product/*` | Those pages **describe** the software; they aren't it. The software is `beta.resomix.com`, which already declares `WebApplication`. Declaring an app on a page where none is accessible is the "describes content not on the page" failure Google names. |
| `offers` / `price` on `Service` or `SoftwareApplication` | Pricing is behind `/subscribe` and is plan-dependent. Assert it only if a fixed, visible price appears on the page itself. |
| `aggregateRating` / `review` | **We have no reviews.** This is the single most common cause of a structured-data manual action. Never synthesise it. |
| `Product` anywhere | Resomix sells access to a service, not a product with SKU/price/availability. |
| `sameAs` beyond the four verified profiles | Add only URLs the company controls and can prove. |

---

## 6. Deferred — `FAQPage` (highest expected value)

Per 2026 research, `FAQPage` with 4+ Q&A pairs and substantial answers is the **strongest single
schema signal for AI citations** (reported ~+34% Perplexity, ~+28% ChatGPT) — well above adding more
entity types.

**Blocked on content, not code.** It requires the Q&A to be **visible on the page**. Several pages are
already close — `/solutions/music-libraries-sample-providers` has *"Aren't tags enough?"* as a heading
with the answer beneath — but this needs Marco's copy, which is George's §4 (GEO content structure)
anyway.

**When that copy lands, `FAQPage` is the next thing to add — not more entity types.**

---

## 7. Per-route matrix

| Route(s) | Types emitted |
|---|---|
| `/` | `Organization`, `WebSite`, `WebPage` |
| `/about`, `/trust`, `/subscribe`, `/contact`, `/waitlist` | `WebPage`, `BreadcrumbList` |
| `/product`, `/product/*` | `WebPage`, `BreadcrumbList` |
| `/partners`, `/partners/pilot` | `WebPage`, `BreadcrumbList`, **`Service`** |
| `/solutions/*` (7) | `WebPage`, `BreadcrumbList`, **`Service`** |
| `/developers` | `WebPage`, `BreadcrumbList`, **`WebAPI`** |
| `/error`, `/404`, redirects, hand-offs | **none** — `noindex`; describing them is noise |
| beta `/`, `/sonic-discovery`, `/analysis` | `Organization`, `WebApplication`, `WebPage` |

---

## 8. Implementation notes

- All of it goes in **`tooling/prerenderHead.ts`**, which already emits `WebPage` + `BreadcrumbList`
  per route. `Organization`/`WebSite` live in each app's `index.html`.
- Per-route entity config (which routes get `Service`, their `serviceType`) belongs in
  **`seoConfig.ts`**, beside the title and description, so one file stays the source of truth.
- **One `<script type="application/ld+json">` per concern is fine** — Google merges multiple blocks.
  Keep the site-level graph in the shell and the page-level graph injected, as today.
- `@id` everywhere, so nodes reference rather than duplicate. `WebPage.isPartOf` → `#website`,
  `Service.provider` → `#organization`.
- Extend `apps/landing/src/test/structuredData.spec.ts`: assert `sameAs` has no empty entries, that
  every `Service` has a `provider` resolving to the Organization `@id`, that `mainEntity` resolves to
  a node present in the same graph, and that **no** node carries `aggregateRating` or `offers`.

---

## 9. Verification

1. `pnpm build`, then run the built HTML through the **Rich Results Test** and **Schema Markup
   Validator** — test the *built* file, not the source.
2. Spot-check one route per type: `/` (Organization), `/solutions/djs` (Service + Breadcrumb),
   `/developers` (WebAPI), `beta.resomix.com/` (WebApplication).
3. After deploy: Search Console → **Enhancements**, watch for parse errors over ~2 weeks.
4. Expect **no new rich results** from `Service` or `WebAPI`. The gain is entity clarity for Google's
   Knowledge Graph and retrievability for AI answer engines. If SERP appearance is the goal, the
   lever is `FAQPage` (§6), and that needs copy.

---

## 10. Order of work

1. `Organization` — `sameAs`, `contactPoint`, `foundingLocation` *(small, highest confidence)*
2. `mainEntity` on `WebPage`
3. `Service` on the nine partner/solutions routes
4. `WebAPI` on `/developers`
5. Tests + validator pass
6. **`FAQPage` when Marco's copy lands** — the one with real upside
