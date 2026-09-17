# AI Visibility Content Audit

Status: complete on the website side, 17 September 2026. Everything in this document that could
be done in the repository or in Cloudflare is built, tested and checked on staging, and it reaches
resomix.com with the next production release. What remains either follows that release (Bing,
IndexNow and the note to Vladimir, §10 and §13) or belongs to George (§11). This document is the
technical record. The plain-language version for George is `AI_VISIBILITY_SUMMARY.md`.
Prepared: 17 September 2026.
Sources compared: the ShelfSignal report "Resomix on the AI shelf" (collected 15 September 2026),
Vladimir's two WhatsApp messages of 16 September and his follow-up with seven fixes, the full
English copy of every landing page (`apps/landing/src/locales/en/`), the live route metadata
(`apps/landing/src/routes/seoConfig.ts`), the shell (`apps/landing/index.html`), `llms.txt`,
`robots.txt`, `_redirects`, the prerender tooling, and the three existing SEO documents.

How this relates to the existing documents:

- `SEO_METADATA_ALL_PAGES.md` stays authoritative for titles and H1s. Every title already carries
  "Resomix" and no title changes are proposed. Twelve descriptions are proposed for replacement
  because they do not name Resomix (§3.2).
- `STRUCTURED_DATA_PLAN.md` deferred `FAQPage` "until copy lands" (its §6). The FAQ copy is in
  this document, so that item is now unblocked. Its §5 said no `SoftwareApplication` on product
  pages; §3.5 below explains why the two live product pages are the exception.
- `SEO_AND_PERFORMANCE.md` §4.3 listed George's "GEO content structure" as not started. This
  document is that work, scoped to micro-edits rather than a rewrite.

The scope agreed with Usman: keep the language, tone and style of the existing site; make micro
edits and additions that satisfy the report; do the Cloudflare and metadata work first.

---

## 1. The baseline the next report will compare against

From the report, 20 buyer questions × 5 assistants × 5 runs = 500 answers.

| Measure | 15 Sep 2026 |
|---|---|
| Share of voice | 2% (named in 8 of 500 answers) |
| Shelf rank | #91 of 735 brands |
| Average place when named | 4.3 |
| Named first | 0% |
| Per assistant | Perplexity 8%, ChatGPT 0%, Claude 0%, Grok 0%, Gemini 0% |
| Homepage (`https://www.resomix.com/`) | read in 15 answers, named in 8 |
| Sonic Discovery (`https://resomix.com/product/sonic-discovery/`) | read in 2 answers, named in 0 |

Vladimir will compare exactly these: share of voice, rank, the per-assistant split, and pages read
versus named. He re-runs 2 to 3 weeks after go-live and needs the go-live date and the list of
changed URLs.

Two details in that table matter for the work below:

- The homepage was read on the **www** host, and its title was recorded as "Resomix - Discovery by
  Sound". That title exists nowhere in the current build, so at least one assistant was working
  from a stale snapshot of the www variant. The www redirect currently drops the path (verified
  earlier this week) and Bing has never been given the sitemap. §8 and §10 address both.
- Sonic Discovery was read **with a trailing slash**. Its canonical is the bare URL, and the bare
  URL currently 308-redirects to the slashed one because Cloudflare Pages serves
  `dist/product/sonic-discovery/index.html`. The canonical points at a URL that redirects. §9.

### 1.1 The 20 buyer questions and which page should own each

| Buyer question | Named in | Owning page (secondary) |
|---|---|---|
| music discovery tools for DJs | 5 / 25 | `/solutions/djs` (`/`) |
| best tools for DJs to find tracks | 2 / 25 | `/solutions/djs` |
| how to find tracks that match a reference track | 1 / 25 | `/product/sonic-discovery` |
| best audio analysis API for music | 0 / 25 | `/developers` |
| best BPM and key detection tool | 0 / 25 | `/product/track-intelligence` |
| best tool to find similar sounding tracks | 0 / 25 | `/product/sonic-discovery` |
| find music based on sound | 0 / 25 | `/product/sonic-discovery` (`/`) |
| find music by sound | 0 / 25 | `/` (`/product/sonic-discovery`) |
| how to find music that matches a creative brief | 0 / 25 | `/solutions/sync-agencies` (`/solutions/music-curators`) |
| how to find similar tracks in a music catalogue | 0 / 25 | `/product/catalog-intelligence` |
| how to find tracks that mix well together | 0 / 25 | `/solutions/djs` |
| how to search a music catalogue by sound | 0 / 25 | `/product/catalog-intelligence` (`/solutions/record-labels`) |
| music catalogue metadata enrichment tools | 0 / 25 | `/product/track-intelligence` (`/solutions/record-labels`) |
| music library search | 0 / 25 | `/solutions/music-libraries-sample-providers` |
| music search by audio | 0 / 25 | `/product/sonic-discovery` |
| music search by upload | 0 / 25 | `/product/sonic-discovery` (`/developers`) |
| music similarity search | 0 / 25 | `/product/sonic-discovery` (`/product`, `/developers`) |
| music tagging and mood detection software | 0 / 25 | `/product/track-intelligence` |
| tools for sync agencies to find tracks | 0 / 25 | `/solutions/sync-agencies` |
| track analysis software | 0 / 25 | `/product/track-intelligence` |

The report says these questions carry 85% of the answers measured. The page that owns a question
must use the question's own words in its first paragraph or its FAQ, not only in a heading or a
diagram.

### 1.2 The five properties competitors are credited with

| Property | Gap | Do we have it | Where it must be readable |
|---|---|---|---|
| Music similarity search | 31% | Yes, it is the product | The exact phrase appears nowhere on the site today. Add it to Sonic Discovery, Product, Developers and the homepage. |
| Audio fingerprinting | 21% | No. Resomix does not identify recordings | Say what we do instead, once, in the Sonic Discovery and Product FAQs. The report's own advice: "say what it has instead rather than staying silent". |
| Automatic music tagging | 20% | Partly. Track Intelligence predicts genre, style, mood and instrumentation with confidence; the API returns scored genre labels and mood themes | Track Intelligence identity section and FAQ; Developers analysis schema already lists it. |
| Large-catalogue processing | 15% | Yes. Managed batch ingestion, private index rebuilt per batch | Catalogue Intelligence and Developers. A scale figure needs George's decision (§11). |
| Musical key detection | 13% | Yes. Key, Camelot, confidence, alternative key | Track Intelligence harmony section and FAQ, in the words "key detection" and "BPM detection". |

---

## 2. The fixes, mapped to owners and to this pass

Vladimir's seven fixes, the report's six moves, and who does what.

| # | Fix | Source | Owner | In this pass |
|---|---|---|---|---|
| 1 | A sentence under the H1 naming the brand: "Resomix Sonic Discovery is a music similarity search tool…" | Vladimir 1, report M2 | Usman (copy in this doc) | Yes, every indexable page (§5) |
| 2 | "Resomix" in the meta description and og:description | Vladimir 2, report M2 | Usman | Yes, 12 routes (§3.2). og:description is generated from the same string, so one edit covers both |
| 3 | "Resomix (PYXIS-1 engine)" instead of bare "PYXIS-1" | Vladimir 3 | Usman | Yes, first body mention per page, in the site's own phrasing (§4.2) |
| 4 | Diagram steps as plain text, not only SVG | Vladimir 4, report M2 | Usman | Yes. Verified: Sonic Discovery flow stages 01 to 04 are SVG `<text>`; only stage 05 is HTML (§5.3) |
| 5 | FAQ in buyer wording, plus `FAQPage` and `SoftwareApplication` schema | Vladimir 5, report M1/M3 | Usman | Yes. FAQ copy drafted per page (§5); schema in §7 |
| 6 | One canonical URL (slash, www) with 301s | Vladimir 6 | Usman (code) + Cloudflare | Yes (§8, §9) |
| 7 | Bing Webmaster Tools and IndexNow | Vladimir 7, report M4 | Usman with George's account access | Yes (§10) |
| M1 | Own the 17 questions Resomix is absent from | Report | Content team (George/Marco) for new articles; Usman for existing pages | Existing pages: yes. New Journal articles: later, George decides |
| M4 | Get named on the four missing assistants; check crawlers are not blocked | Report | Usman (Cloudflare), George (ask the questions and record sources) | Cloudflare checks: yes (§8). Source list: after go-live |
| M5 | Move into the first three names; answer the DJ question in the first line | Report | Usman (copy) | Yes, `/solutions/djs` first paragraph (§5.13) |
| M6 | Get cited on cyanite.ai, github.com, reddit.com, digdeeper.fm, wikipedia | Report | George (PR/partnerships) | No. Out of scope for a site edit |

Vladimir's caveat on crawler access: a spoofed User-Agent test returning 200 proves only that the
origin serves the page. Cloudflare can still challenge or block the real bots. The proof is in
Cloudflare's own logs for `OAI-SearchBot`, `ChatGPT-User`, `GPTBot`, `ClaudeBot`, `Claude-User`,
`PerplexityBot`, `Perplexity-User`, `Google-Extended` and `Bingbot`. §8 says where to look.

---

## 3. What the site says today, measured against the report

### 3.1 Brand mentions in body copy, per page

Counted from the locale JSON with figure, aria and alt strings excluded (assistants strip those as
well). "Tied" means the first body sentence that mentions PYXIS-1 also names Resomix.

| Page | "Resomix" | "Resomix is / Resomix's" | "PYXIS-1" | First PYXIS-1 mention tied to Resomix |
|---|---|---|---|---|
| about | 26 | 4 | 5 | in the second sentence, fine |
| product | 13 | 2 | 10 | yes, in `hero.body` |
| trust | 21 | 2 | 8 | fine, Resomix dominates |
| home | 10 | 0 | 6 | no |
| musicPublishers | 8 | 2 | 3 | yes, `activate.p2` |
| djs | 7 | 2 | 1 | yes, `journeys.lead1` |
| syncAgencies | 6 | 0 | 2 | yes, `workflows.lead1` |
| developers | 4 | 2 | 1 | eyebrow only |
| catalogueIntelligence | 4 | 0 | 10 | `hero.body` names both, but PYXIS-1 leads |
| musicCurators | 4 | 0 | 1 | no |
| partnersPilot | 3 | 0 | 4 | no |
| musicLibraries | 3 | 0 | 1 | no |
| producers | 3 | 0 | 6 | yes, `hero.support` |
| partners | 2 | 0 | 1 | no |
| recordLabels | 2 | 1 | 0 | n/a |
| **sonicDiscovery** | **1** | **0** | **10** | **no** |
| **trackIntelligence** | **0** | **0** | **3** | **no** |

Vladimir's diagnosis of Sonic Discovery is confirmed by the numbers: one "Resomix" against ten
"PYXIS-1", and the single "Resomix" is in the CTA note ("opens the Resomix app"). Track
Intelligence is worse: the body never says "Resomix" at all. An assistant that strips header, nav
and footer reads both pages as pages about a thing called PYXIS-1.

### 3.2 Meta descriptions without "Resomix"

Twelve of the twenty indexable routes. `og:description` and `twitter:description` are generated
from the same string in `tooling/prerenderHead.ts`, so fixing `seoConfig.ts` fixes all three.

`/`, `/product/sonic-discovery`, `/product/track-intelligence`, `/developers`, `/partners`,
`/partners/pilot`, `/trust`, `/solutions/record-labels`,
`/solutions/music-libraries-sample-providers`, `/solutions/djs`, `/solutions/music-curators`,
`/solutions/producers`.

Already fine: `/about`, `/product`, `/product/catalog-intelligence`, `/solutions/music-publishers`,
`/solutions/sync-agencies`, `/pricing`, `/contact`, `/waitlist`. All twenty titles carry "Resomix".

### 3.3 The one site-wide "Resomix is…" sentence

Every prerendered page ships the beta notice above the H1
(`packages/ui/src/Elements/DemoStageBanner.tsx`):

> Resomix is currently in beta. You may encounter bugs or incomplete features while we continue
> improving the sonic discovery experience.

Vladimir is right that this is the only sentence of the form "Resomix is…" on the Sonic Discovery
page, and it is the first such sentence on every page. The fix is not to remove the notice. It is
to give every page its own quotable definition sentence in the first paragraph under the H1, so
the notice is no longer the first thing an assistant can attribute to the name. An optional
rewording of the notice is listed for George in §11.

### 3.4 Diagram text that is invisible to assistants

- Sonic Discovery, `sections/sonic-discovery/scenes/SdFlowPanel.tsx`: stages 01 to 04 and their
  sub-labels are SVG `<text>` elements. Stage 05 and the timing line are HTML. The five-step flow
  is the page's core explanation and four fifths of it is unreadable.
- Sonic Discovery, `SdScene1Figure.tsx`: "Compares the reference with the pre-analysed sonic index"
  is SVG text.
- The homepage "How Resomix works" steps (`home.how.*`) and the pilot stages
  (`partnersPilot.hero.mobileStages`, `catalogueIntelligence.pilot.stages`) are HTML and need no
  change. Confirm at implementation that the Product and Catalogue Intelligence flow figures do
  not carry copy that exists only inside the SVG.

### 3.5 Structured data shipping today

| Where | Types |
|---|---|
| `apps/landing/index.html` | `Organization` (name, url, logo, description only), `WebSite` |
| every prerendered route | `WebPage` (name and description from `seoConfig`), `BreadcrumbList` on nested routes |

Not shipping: `sameAs`, `contactPoint`, `foundingLocation` on the Organization (all three were
approved in `STRUCTURED_DATA_PLAN.md` §2 and never landed), `FAQPage`, `SoftwareApplication`,
`Service`, `WebAPI`.

On `SoftwareApplication`: the plan's §5 declined it on `/product/*` because those pages "describe
the software". That reasoning holds for Catalogue Intelligence (a managed pilot, not a thing a
visitor can open). It does not hold for Sonic Discovery and Track Intelligence: both are live
features of the application at `beta.resomix.com`, each page links straight into them, and the
page is the canonical description of that feature. Marking them up with `url` pointing at the
app, `provider` pointing at the Organization, and no `offers` or `aggregateRating`, is accurate
and low-risk. Vladimir asked for it by name.

### 3.6 Crawl access, as far as the repository can show

- `robots.txt` allows everything for every agent. No AI-specific disallow lines.
- Pages are prerendered head and body (`SEO_AND_PERFORMANCE.md` §1.18), so the copy is in the raw
  HTML without JavaScript. That satisfies the report's "render key text server-side".
- The repository cannot show Cloudflare zone settings. The AI-bot toggle, Bot Fight Mode and any
  WAF rule are checked in the dashboard (§8).

### 3.7 llms.txt

Exists, has an H1, links every live route. Its page lines describe the products but do not use the
buyer phrases, and it states nothing about what Resomix is not. §6 has the revised text.

---

## 4. House rules for every edit

These are taken from the existing copy and from `PAGE_BRIEFS.md`, so the additions read as if
Marco wrote them.

### 4.1 Voice

- British spelling in public copy: catalogue, analyse, organisation, authorised. The `catalog`
  spelling in the Catalogue Intelligence URL and title is a deliberate split and stays.
- Short declarative sentences. Some existing copy opens an explanation with a colon. New copy does
  not, because the pattern reads as machine-written, so it splits into two sentences instead. No
  exclamation marks and no em dashes in the new text.
- No superlatives about ourselves. The buyer questions say "best"; the pages answer them with a
  checkable statement, never with "the best".
- The eyebrow style (`01 // The profile`) and the H1 accent markers `[[…]]` are untouched.
- H1s are design-closed and stay exactly as they are.
- No new claims. Numbers already on the site may be reused: 70+ characteristics, deletion no later
  than 24 hours, search around 5 to 6 seconds and upload around 15 to 20 seconds (observed, not a
  commitment), MP3/WAV/FLAC/AIFF. Nothing else without George's sign-off (§11).
- "Human decision" is the constant closing note on solution pages. Every FAQ that touches
  selection, clearance or creative choice ends with it.

### 4.2 The brand tie rule

Vladimir's literal suggestion is "Resomix (PYXIS-1 engine)". The site already has its own way of
saying this, on the DJs and Publishers pages:

- "Resomix's deterministic engine PYXIS-1"
- "Resomix's proprietary engine PYXIS-1"

Rule: the first sentence in body copy that mentions PYXIS-1 on each page uses one of
"Resomix's PYXIS-1 engine", "PYXIS-1, Resomix's proprietary engine" or "Resomix's deterministic
engine PYXIS-1". Later mentions stay plain "PYXIS-1". Eyebrows, captions and figure labels are not
counted, because assistants do not read them.

### 4.3 The definition sentence

Every indexable page gets one sentence, in its first paragraph under the H1, of the form:

> Resomix [product or page subject] is a [category in the buyer's words] that [what it does] for
> [who].

Twenty to forty words, present tense, quotable on its own. It uses the exact buyer phrase the page
owns (§1.1). On the solution pages, whose openings are essay-style, the sentence is prepended to
the existing opening paragraph, so nothing new is rendered and the layout is untouched.

### 4.4 The FAQ block

Approved by George on 17 September 2026 for the four product pages and the seven solution pages,
and built. The FAQs drafted in §5 for Home, Developers, Partners and the Pilot page are not
approved yet.

- One block per page, placed after the last content section and before the closing CTA, so it
  does not disturb the designed flow above it.
- Four to six questions, each phrased the way a buyer asks an assistant. Answers of two to four
  sentences, containing "Resomix" at least once, and only facts already on the page or on `/trust`.
- Rendered open and visible, in the site's numbered protocol style (`Q01`, `Q02`), as `<h3>`
  question and `<p>` answer. Not collapsed by default: the copy has to be readable in the static
  HTML, and Google's rule for `FAQPage` is that the Q&A is visible on the page.
- One shared section component (in `packages/ui` or `apps/landing/src/sections/shared`, with its
  barrel export) reads the page's `faq` array from its locale JSON. No logic in page `.tsx` files.
- The `FAQPage` JSON-LD is generated at build time from the same locale keys in
  `tooling/prerenderHead.ts`, so schema and visible copy cannot drift.
- No FAQ on `/trust` beyond what exists: its rights section is already a visible Q&A list and can
  emit `FAQPage` as it is.

---

## 5. Per-route audit and proposed edits

Character counts on proposed descriptions are script-validated against the 150 to 160 range used by
`SEO_METADATA_ALL_PAGES.md` (the test in `routeSeo.spec.ts` allows 50 to 160). Titles are
unchanged everywhere.

### 5.1 Home `/`

- Title (unchanged): Resomix: Find & Analyse Electronic Music by Sound
- Description (current, no Resomix): Drop one track and hear what belongs next. The PYXIS-1 engine
  powers sonic similarity search, track analysis and catalogue intelligence for electronic music.
- **Applied description** (159 chars): Resomix finds electronic music by how it sounds. Drop one
  track and its PYXIS-1 engine returns a ranked shortlist, reads one recording or searches a catalogue.
- H1 (unchanged): Drop one track. Find what belongs next.
- First paragraph today, `home.hero.platform`: "Resomix reveals a track's unique identity, subtle
  connections, and its place within a music catalogue."
- **Applied `home.hero.platform`**: "Resomix is a music similarity search and audio analysis
  platform for electronic music. Drop one track and it reveals the track's identity, its closest
  sonic relatives and its place within a music catalogue."
- Brand tie: `home.how.step02` "PYXIS-1 builds a sonic profile" becomes "Resomix's PYXIS-1 engine
  builds a sonic profile". The eyebrow "Production beta · Powered by PYXIS-1" stays.
- Buyer phrases to land in body: "find music by sound", "music similarity search". The proposed
  hero sentence carries the second; `home.statement.sub` already says "discover and filter music by
  how it actually sounds" and can stay.
- Steps: the four "How Resomix works" steps are HTML already.
- Proposed FAQ, new key `home.faq`:
  1. **What is Resomix?** Resomix is a sonic intelligence platform for electronic music. Its
     PYXIS-1 engine reads more than 70 measurable audio characteristics from a recording and uses
     them to find similar tracks (Sonic Discovery), analyse one track (Track Intelligence) and make
     an authorised catalogue searchable by sound (Catalogue Intelligence).
  2. **How do I find music by sound?** Search for a track already in the Resomix catalogue, or
     upload your own reference. PYXIS-1 compares its sonic profile with a pre-analysed index and
     returns a ranked playlist of the closest matches, which you can audition, save or use as the
     next reference.
  3. **Is Resomix a song-identification app like Shazam?** No. Audio fingerprinting tells you what
     a recording is. Resomix tells you what sounds like it. It starts from a track you already have
     and finds its closest sonic relatives, whoever released them and whenever.
  4. **Is Resomix free?** Sonic Discovery is free to start during the production beta. A Pro plan
     is available for deeper use, and the plans are compared on the pricing page.
- Schema: `WebPage` (exists) plus `FAQPage`. The Organization node in `index.html` gains `sameAs`,
  `contactPoint` and `foundingLocation` (§7).

### 5.2 Product overview `/product`

- Title and description: unchanged. The description already names Resomix and PYXIS-1.
- H1 (unchanged): Start with sound. Know where to go next.
- First paragraph today, `product.hero.body`: "Resomix uses PYXIS-1 to find related tracks, read
  one recording in detail, or make an authorised catalogue searchable by sound." Already a
  definition sentence and already tied. One addition so the buyer phrase is present:
- **Applied `product.hero.body`**: "Resomix is a music similarity search and audio analysis
  platform. It uses its PYXIS-1 engine to find related tracks, read one recording in detail, or
  make an authorised catalogue searchable by sound."
- Proposed FAQ, new key `product.faq`:
  1. **What is the difference between Sonic Discovery, Track Intelligence and Catalogue
     Intelligence?** Sonic Discovery finds tracks that sound like a reference. Track Intelligence
     explains one recording, from structure and tempo to key, energy, timbre and mood. Catalogue Intelligence
     applies the same engine to an authorised partner catalogue inside a private index. All three
     run on Resomix's PYXIS-1 engine.
  2. **What is PYXIS-1?** PYXIS-1 is Resomix's proprietary audio-analysis and similarity engine. It
     extracts more than 70 measurable characteristics across rhythm, harmony, timbre, structure,
     spectral profile and energy, and combines them into one sonic profile per recording. It is not
     a generative system and does not create audio.
  3. **Does Resomix identify songs?** No. Resomix is not an audio fingerprinting service. It does
     not tell you what a recording is. It finds and explains recordings by how they sound.
  4. **Does Resomix train on my audio?** No. Uploaded references are deleted no later than 24 hours
     after upload or analysis, and neither user nor partner audio is used to train or fine-tune
     PYXIS-1.
  5. **Is there an API?** Yes, a partner-scoped REST API for search, similarity and track analysis
     against your own catalogue, reached through a guided pilot. There is no public sandbox.
- Schema: `WebPage` plus `FAQPage`.

### 5.3 Sonic Discovery `/product/sonic-discovery` (the page the report singled out)

- Title (unchanged): Find Similar Tracks by Sound: Sonic Discovery | Resomix
- Description (current, no Resomix): Start with one track or upload a reference. PYXIS-1 compares
  sonic profiles against a pre-analysed index and returns a ranked playlist of close matches.
- **Applied description** (158 chars): Resomix Sonic Discovery is a music similarity search tool.
  Start with one track or upload a reference and PYXIS-1 returns a ranked playlist of similar tracks.
- H1 (unchanged): Find similar tracks by sound.
- First paragraph today, `sonicDiscovery.hero.sub`: "Search by how the music actually sounds.
  PYXIS-1 reads the groove, energy, timbre and structure of your reference (drawn from 70+
  measurable audio characteristics) and returns a ranked shortlist you can listen, analyse, and
  develop."
- **Applied `sonicDiscovery.hero.sub`**: "Resomix Sonic Discovery is a music similarity search
  tool that searches by how the music actually sounds. Resomix's PYXIS-1 engine reads the groove,
  energy, timbre and structure of your reference (drawn from 70+ measurable audio characteristics)
  and returns a ranked shortlist you can listen to, analyse and develop." (Also repairs "you can
  listen, analyse, and develop".)
- Brand tie: done by the sentence above. `console.lead` ("give PYXIS-1 a reference") and
  `dims.lead` can stay as later mentions.
- **Plain-text steps** (fix 4), new key `sonicDiscovery.steps`, rendered as a visible numbered
  list beside or below the flow panel, in the protocol style already used for the "returned" line.
  Every line is lifted from existing flow keys:
  1. **Reference.** Search for a track already in the index, or upload your own. A searched track
     uses its existing sonic profile, and an upload is profiled on arrival.
  2. **Sonic profile.** PYXIS-1 reads rhythm, harmony, timbre, structure and energy, from 70+
     measurable audio characteristics.
  3. **Comparison.** The profile is compared with the pre-analysed sonic index. Catalogue
     candidates are already profiled, so nothing is reanalysed per search.
  4. **Ranking.** The closest matches are ranked automatically. No manual selection.
  5. **Playlist.** The Sonic Discovery playlist is returned, in around 5 to 6 seconds for a search
     and 15 to 20 seconds for an upload (observed, not a service-level commitment). Audition, save,
     export, or chain a result as your next reference.
  The SVG stays as the visual; the list is the text an assistant can quote.
- Buyer phrases to land in body: "music similarity search" (hero), "find tracks that match a
  reference track", "music search by upload", "similar sounding tracks" (FAQ).
- Proposed FAQ, new key `sonicDiscovery.faq`:
  1. **How do I find tracks that sound like a track I already have?** Search for the track in
     Resomix, or upload the file, and Sonic Discovery returns a ranked playlist of the closest
     matches by sound, judged on groove, energy, timbre and structure rather than on genre tags or
     release date.
  2. **Can I search for music by uploading a file?** Yes. Upload an MP3, WAV, FLAC or AIFF as your
     reference. Resomix processes it privately, uses it only as the query, and deletes the source
     audio no later than 24 hours after upload or analysis.
  3. **Is Sonic Discovery an audio fingerprinting or song-identification tool?** No. Fingerprinting
     tells you what a recording is. Resomix tells you what sounds like it, meaning the tracks with
     the strongest measured sonic relationship to your reference, whoever released them and whenever.
  4. **How does Resomix decide which tracks are similar?** Resomix's PYXIS-1 engine builds a sonic
     profile from more than 70 measurable audio characteristics of the whole recording, then
     compares it with a pre-analysed index. The result is deterministic, so the same reference
     against the same index returns the same shortlist, each result with its similarity score.
  5. **Which catalogue does it search?** The Resomix catalogue of electronic music, already
     profiled by PYXIS-1. Partner catalogues are separate and private. See Catalogue Intelligence.
  6. **Can DJs use it to find tracks that mix well together?** Yes. The shortlist is ranked by
     groove, energy and structure, and Track Intelligence shows the key, Camelot code and BPM of any
     result, so you can check compatibility before you play it. The selection stays yours.
- Schema: `WebPage` plus `SoftwareApplication` (name "Resomix Sonic Discovery",
  `applicationCategory` "MultimediaApplication", `operatingSystem` "Web browser", `url` the beta
  app route, `provider` the Organization, `featureList` from the "why trust it" section) plus
  `FAQPage`.

### 5.4 Track Intelligence `/product/track-intelligence`

- Title (unchanged): Track Analysis: Structure, Key, BPM & Energy | Resomix
- Description (current, no Resomix): Track Intelligence turns PYXIS-1 audio analysis into a
  readable view of one recording: structure, tempo, key, energy, timbre, spectral character,
  confidence.
- **Applied description** (157 chars): Resomix Track Intelligence is track analysis software. It
  reads BPM, key and Camelot, structure, energy, loudness, timbre, genre and mood from one recording.
- H1 (unchanged): See how the track moves, changes and holds together.
- First paragraph today, `trackIntelligence.hero.sub`: "Through 70+ measurable audio
  characteristics, PYXIS-1 measures a song's rhythm, energy, harmony, timbre, spectral behaviour and
  structure, and turns these traits into one readable track profile."
- **Applied `trackIntelligence.hero.sub`**: "Resomix Track Intelligence is track analysis
  software for one recording at a time. Through 70+ measurable audio characteristics, Resomix's
  PYXIS-1 engine measures a song's tempo, key, rhythm, energy, harmony, timbre, spectral behaviour
  and structure, and turns these traits into one readable track profile."
- The body never says "Resomix" today. Three further insertions:
  - `structure.lead`: "A structural score with the waveform, beat grid and sections on one
    timeline." becomes "BPM detection and a structural score, with the waveform, beat grid and
    sections on one timeline. Select a section to read its role."
  - `harmony.lead`: becomes "Musical key detection with confidence. The detected key and Camelot
    code sit up front with a readable chromagram strip, and the full pitch evidence and harmonic
    relationships one step deeper."
  - `identity.lead`: becomes "Automatic genre, style, mood and instrumentation tagging, shown as
    coordinated signals with confidence. Stronger and weaker, never absolute."
  - `energy.body`, last sentence: "Our analysis just describes the music; the decision-making
    process is in your hands only." becomes "Resomix's analysis describes the music. The decision
    stays in your hands."
- The page is labelled SAMPLE DATA throughout. The FAQ must not present the sample numbers as
  results, and does not.
- Buyer phrases to land: "track analysis software" (hero), "BPM and key detection" (structure and
  harmony leads), "music tagging and mood detection" (identity lead and FAQ), "metadata enrichment"
  (FAQ, answered honestly).
- Proposed FAQ, new key `trackIntelligence.faq`:
  1. **How do I find the BPM and key of a track?** Upload the track to Resomix and open Track
     Intelligence. Tempo, key and Camelot code are measured directly from the audio and shown with a
     confidence value, alongside structure, loudness and energy.
  2. **How accurate is the key detection?** Measured values such as tempo, key and loudness are read
     from the recording, so the same file always returns the same result, and the key is shown with
     its confidence and any alternative key. Predicted values such as genre and mood are
     classification signals, shown with confidence, never as absolutes.
  3. **Does Resomix tag genre and mood automatically?** Yes, as predicted signals. Track Intelligence
     reports genre and style, mood and theme, and instrumentation such as vocal presence, each with
     a confidence level and with secondary signals kept visible instead of forced into one label.
  4. **Can Track Intelligence enrich catalogue metadata?** For a partner catalogue, yes. The same
     analysis runs across every authorised recording so structure, tempo, key, mood and genre are
     described in the same terms for every track, and it can flag inconsistent tagging. Resomix
     does not edit your metadata. It gives your team consistent evidence to work from.
  5. **Can I analyse my own unreleased track?** Yes. The upload is processed privately, is not used
     to train PYXIS-1, and the source audio is deleted no later than 24 hours after upload or
     analysis.
  6. **Can I get the analysis as data?** Partners can retrieve versioned, structured JSON through
     the Resomix API, with rhythm, tonality, loudness, mood, structure and provenance fields.
     Analysis access is enabled on request.
- Schema: `WebPage` plus `SoftwareApplication` (name "Resomix Track Intelligence") plus `FAQPage`.

### 5.5 Catalogue Intelligence `/product/catalog-intelligence`

- Title (unchanged): Make Your Music Catalog Searchable by Sound | Resomix
- Applied description, so the buyer phrase is present (157 chars):
  Search your music catalogue by sound. Resomix processes authorised recordings into a private,
  partner-scoped index, and one reference returns ranked matches.
- H1 (unchanged): Make your catalogue discoverable by sound.
- First paragraph today, `catalogueIntelligence.hero.body` (note the lowercase opening, a live
  typo): "with PYXIS-1, Resomix creates a sonic profile for every track in your sound library and
  makes your music searchable by sound. Start with one recording and discover ranked matches from
  across your catalogue."
- **Applied `catalogueIntelligence.hero.body`**: "Resomix Catalogue Intelligence lets labels,
  publishers, distributors and libraries search a music catalogue by sound. Resomix's PYXIS-1
  engine creates a sonic profile for every authorised recording and makes the catalogue searchable
  by sound. Start with one recording and discover ranked matches from across your catalogue."
- Large-catalogue processing: add one sentence to `partner.body1` after "In a scoped integration,
  authorised server-side requests bring the results into your own product or workflow.": "Catalogues
  are delivered in batches through managed ingestion, and the private index is rebuilt as each
  batch lands." (This is already stated on `/developers`.)
- Proposed FAQ, new key `catalogueIntelligence.faq`:
  1. **How can a label make its back catalogue discoverable?** Resomix processes the authorised
     recordings once into a private, partner-scoped sonic index. From then on any track, old or new,
     can be returned when it sounds right for the reference, without waiting for streams, sales or
     editorial attention.
  2. **How do I find similar tracks inside our own catalogue?** Use any indexed track as the
     reference, or upload a recording. PYXIS-1 compares it with your catalogue and returns the
     closest matches, ranked by similarity, with no manual shortlisting.
  3. **Is our catalogue shared with other partners or made public?** No. Each partner's audio,
     derived profiles and index stay inside that partner's scope. There is no shared partner pool,
     and partner content is not made publicly available.
  4. **Is our audio used to train PYXIS-1?** No. Partner content is not used to train or fine-tune
     PYXIS-1, and Resomix does not generate derivative audio.
  5. **What do we need to deliver?** Authorised audio as MP3, WAV, FLAC or AIFF, and a CSV manifest
     with ISRC, title, artist and filename for each track, through the managed partner workflow.
  6. **How large a catalogue can Resomix process?** Catalogues are ingested in batches and the
     index is rebuilt as each batch lands, so the size is agreed per pilot rather than capped up
     front. A representative sample is enough to start.
- Schema: `WebPage` plus `Service` (per the structured-data plan) plus `FAQPage`.

### 5.6 Developers `/developers`

- Title (unchanged): Music Similarity & Audio Analysis API | Resomix Developers
- Description (current, no Resomix): Integrate partner-scoped similarity and track-analysis
  services behind your own product. REST access through a guided pilot, with no public sandbox to
  misuse.
- **Applied description** (156 chars): The Resomix API is a music similarity and audio analysis
  API with search, similarity by track or upload, and versioned track analysis of your own
  catalogue.
- H1 (unchanged): Put similarity and track intelligence inside your product.
- First paragraph today, `developers.hero.sub`: "Search your own catalogue by sound and rank it by
  how the music actually sounds, through a partner-scoped REST API. Structured Track Intelligence
  analysis is enabled on request, against your own catalogue."
- **Applied `developers.hero.sub`**: "The Resomix API is a music similarity and audio analysis API
  for partners, powered by Resomix's PYXIS-1 engine. Search your own catalogue by sound and rank it
  by how the music actually sounds, through a partner-scoped REST API. Structured Track
  Intelligence analysis (tempo, key, loudness, structure, mood and genre signals) is enabled on
  request, against your own catalogue."
- Buyer phrases: "audio analysis API for music" (hero), "music similarity search" (hero),
  "music search by upload" (FAQ).
- Proposed FAQ, new key `developers.faq`:
  1. **Is there an API for music similarity search?** Yes. The Resomix API returns ranked similar
     tracks from your own indexed catalogue, from a catalogue track ID or an uploaded reference of
     up to 100 MB, with scores and metadata in a versioned JSON envelope.
  2. **Can I try the API without a partner agreement?** Not today. There is no public sandbox,
     because similarity is only meaningful inside a real catalogue. The evaluation path is a guided
     pilot with a scoped key against a sample of your own repertoire. A self-serve trial is planned.
  3. **What does the track analysis endpoint return?** Versioned structured JSON covering rhythm
     (BPM, beats, downbeats, phrases), tonality (key, scale, Camelot, tuning, chromagram), loudness and
     dynamics, mood and genre signals with scores, structure with millisecond ranges, and
     provenance. Analysis is enabled per partner on request.
  4. **Does the API search a shared catalogue?** No. Every key searches only that partner's private
     index. A key can never query another partner's catalogue or the Resomix consumer product.
  5. **What are the rate limits?** Per-second limits and monthly quotas are provisioned per partner
     agreement. On HTTP 429, respect Retry-After and back off exponentially.
- Schema: `WebPage` plus `WebAPI` (per the plan) plus `FAQPage`.

### 5.7 Partners `/partners`

- Title (unchanged): Partner With Resomix: Catalogue Discovery by Sound
- Description (current, no Resomix): Labels, distributors, publishers and platforms make authorised
  catalogues searchable by sound. Keep your brand, storefront, licensing and customer control.
- **Applied description** (156 chars): Partner with Resomix. Labels, distributors, publishers and
  platforms make authorised catalogues searchable by sound through a private pilot or the live API.
- H1 (unchanged): Make your catalogue part of sound-first discovery.
- First paragraph today, `partners.hero.sub`: "Start with a private catalogue pilot, or integrate
  the live API. Bring sound-first discovery to your catalogue, platform or music product."
- **Applied `partners.hero.sub`**: "Resomix works with labels, distributors, publishers, music
  libraries and music-technology products in three ways. Start with a private catalogue pilot,
  integrate the live partner API, or scope a deployment together. Bring sound-first discovery to
  your catalogue, platform or music product."
- FAQ: a short one, new key `partners.faq`, because the page is already question-led:
  1. **How do I partner with Resomix?** Tell us about your catalogue, product or integration
     through the form on this page. Resomix checks fit, arranges a scoping call, and both teams
     agree inputs, method and terms before anything is ingested.
  2. **Does submitting the form start a pilot or create an account?** No. It starts a conversation
     about fit. Ingestion begins only after approval.
  3. **Is there a public sandbox?** No. The guided pilot, with a scoped key against your own
     sample, is the evaluation route. A self-serve trial is planned.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.8 Private Catalogue Pilot `/partners/pilot`

- Title (unchanged): Request a Guided Catalogue Pilot: Resomix for Partners
- Description (current, no Resomix): Test PYXIS-1 on your own catalogue. Define the scope,
  references and evaluation criteria, then review ranked results before deciding whether to
  integrate.
- **Applied description** (160 chars): Test Resomix on your own catalogue. A managed private
  pilot for labels, distributors and catalogue teams. Agree scope and scorecard, then review ranked
  results.
- H1 (unchanged): Test PYXIS-1 on the music that matters to your team.
- First paragraph today, `partnersPilot.hero.sub`: "A managed private pilot for labels,
  distributors and catalogue teams. Test sonic discovery on authorised material, with success
  criteria agreed up front."
- **Applied `partnersPilot.hero.sub`**: "The Resomix Private Catalogue Pilot is a managed
  evaluation for labels, distributors and catalogue teams. Test Resomix's PYXIS-1 engine on
  authorised material, with success criteria agreed up front."
- Steps: the six stages are HTML already.
- FAQ, new key `partnersPilot.faq`:
  1. **What do we need to bring?** Authorised audio, a CSV manifest, a representative mix of
     current and older repertoire, known reference tracks, a few expert reviewers and one clear
     question the pilot should answer.
  2. **How long does a pilot take?** The timeline is agreed during scoping. Resomix does not
     publish fixed pilot durations.
  3. **What happens at the end?** A decision pack rather than a sales demo, covering what worked,
     what did not and where the limits are. The outcomes are stop, extend, or plan production. The
     pilot does not convert into a contract automatically.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.9 Trust `/trust`

- Title (unchanged): Trust and Control at Resomix: How We Handle Audio
- Description (current, no Resomix): User uploads are deleted within 24 hours. Partner catalogues
  stay inside private, partner-scoped indexes. No training on your content. No generated audio.
- **Applied description** (150 chars): How Resomix handles audio. Uploads are deleted within 24
  hours, partner catalogues stay in private indexes, and your audio is never used for training.
- Body: `hero.body` already opens "Resomix is a production-beta sonic discovery service." No copy
  changes.
- Schema: emit `FAQPage` from the existing `trust.rights.qa` list (seven visible questions). No
  new copy.

### 5.10 Record Labels `/solutions/record-labels`

- Title (unchanged): Catalogue Search by Sound for Record Labels | Resomix
- Description (current, no Resomix): Make authorised label and distributor catalogues searchable by
  sound. Surface older, relevant recordings beside new releases through ranked sonic matches.
- **Applied description** (158 chars): Resomix lets record labels search their catalogue by
  sound. Authorised recordings become a private index where older, relevant tracks surface beside
  new ones.
- H1 (unchanged): Give authorised recordings another route into discovery.
- Opening today, `recordLabels.hero.intro`: "Running a label is hard, and it always has been…"
  (essay voice, keep).
- **Applied, prepended to `recordLabels.hero.intro`** (nothing new rendered): "Resomix is a
  catalogue search tool for record labels. It analyses the audio itself with its PYXIS-1 engine, so
  a label can search and compare its own releases by how they sound, not only by metadata."
- Brand tie: the body has no PYXIS-1 today; the lead above introduces it. `workflows.lead1` stays.
- FAQ, new key `recordLabels.faq`:
  1. **How can a label make its back catalogue discoverable?** Resomix profiles the authorised
     catalogue once into a private index. An older release can then surface beside a new signing
     whenever the two are close in sound, with no need for it to have a history of attention.
  2. **Can we compare a new demo with our existing catalogue?** Yes. Use the demo as the reference
     and Resomix returns the releases in your catalogue that sit closest to it, ranked by sonic
     similarity.
  3. **Can Resomix help us answer sync requests?** It surfaces candidates from your catalogue that
     match the reference by sound, for your team to review. Clearance and rights decisions stay
     human.
  4. **Is our catalogue visible to other labels?** No. Partner catalogues are logically isolated,
     restricted to authorised access, and never pooled.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.11 Music Publishers `/solutions/music-publishers`

- Title and description: unchanged. The description already names Resomix.
- H1 (unchanged): Turn your catalogue into a living asset
- Opening today, `musicPublishers.hero.body`: "Music publishers face a daunting task: creating a
  cohesive catalog that's both genuine and marketable…"
- **Applied `musicPublishers.hero.body`**, one sentence prepended: "Resomix helps music
  publishers search and understand their repertoire by sound. Publishers face a daunting task:
  creating a cohesive catalogue that's both genuine and marketable, while also knowing how to make
  the most of every track as the collection expands."
- Brand tie: `activate.p2` already says "Resomix's proprietary engine PYXIS-1". No change.
- Spelling consistency (same pass, same file): this page is the only one written in American
  spelling. `hero.body` "catalog", `editorial.p1` "catalog", `editorial.p2` "analyze", "optimize",
  "catalogs", `gap.h2` "Catalog", `gap.p1` "catalog", `gap.p3` "catalog" (twice), `activate.p1`
  "analyzes", `closing.p2` "analyzing". `PAGE_BRIEFS.md` sets British English for public copy.
- FAQ, new key `musicPublishers.faq`:
  1. **How can a publisher find related works across its catalogue?** Start from any recording as
     the reference. Resomix's PYXIS-1 engine compares it with the represented works already profiled
     in your private index and returns the closest, whatever their era or how they were tagged.
  2. **Does Resomix make rights or licensing decisions?** No. It surfaces sonic relationships and
     candidates. Rights context, artist relationships and professional judgement stay with your
     team.
  3. **Is our catalogue exposed to anyone else?** No. Authorised audio, derived profiles and the
     index stay inside your partner scope, and partner content is not made public.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.12 Sync Agencies `/solutions/sync-agencies`

- Title (unchanged): Reference-Based Music Search for Sync Agencies | Resomix
- Description: already names Resomix. Optional replacement to carry the buyer phrase (158 chars):
  Resomix is a reference-based search tool for sync agencies. Use an audio reference to surface
  relevant candidates for human review, never automated clearance.
- H1 (unchanged): Surface candidates by sound. Keep every clearance decision human.
- Opening today, `syncAgencies.hero.intro`: "A talented sync agent can see opportunities where
  others don't…" (keep).
- **Applied, prepended to `syncAgencies.hero.intro`**: "Resomix is a search tool for sync
  agencies. It finds the tracks in a catalogue that match a reference or a brief by how they sound,
  and leaves every clearance decision human."
- Brand tie: `workflows.lead1` already introduces "a sonic similarity engine (PYXIS-1)" as
  Resomix's. No change.
- FAQ, new key `syncAgencies.faq`:
  1. **How do I find music that matches a creative brief?** Start from the reference the brief
     gives you, or the closest track you know. Resomix returns ranked candidates from the catalogue
     that share its groove, energy, timbre and structure, for your team to review, refine and
     clear.
  2. **Does Resomix clear or license music?** No. It supports the search. Clearance, rights and
     placement decisions are made by people.
  3. **Can it search our agency's own catalogue?** Yes, through a private catalogue pilot. Your
     authorised recordings are profiled into a partner-scoped index that only your team can search.
  4. **Does it replace our tagging system?** No. Tags stay yours and stay useful. Resomix adds a
     sonic layer beneath them, so a track that was never tagged for a mood can still be found by
     how it feels.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.13 Music Libraries and Sample Providers `/solutions/music-libraries-sample-providers`

- Title (unchanged): Sound-First Search for Music & Sample Libraries | Resomix
- Description (current, no Resomix): Help authorised libraries and sample catalogues be explored
  through structure, texture and sonic relationships, with ranked results from one audio reference.
- **Applied description** (159 chars): Resomix gives music libraries and sample providers search
  by sound. Start from one sound and PYXIS-1 surfaces related loops, samples and tracks in the
  library.
- H1 (unchanged): Let the library be explored through its sound.
- Opening today, `musicLibraries.hero.intro`: "The bigger a music library becomes, the more
  difficult it becomes to navigate." (keep)
- **Applied, prepended to `musicLibraries.hero.intro`**: "Resomix is a sound-first search
  layer for music libraries and sample providers. Users start from a sound they like and find its
  relatives across the catalogue, instead of typing what they cannot describe."
- Brand tie: `values.lead2` "By analysing the sonic characteristics of individual sounds and loops,
  PYXIS-1 can identify…" becomes "…Resomix's PYXIS-1 engine can identify…".
- FAQ, new key `musicLibraries.faq`:
  1. **Can users search a sample library by sound instead of tags?** Yes. A user picks a sound they
     already like as the reference, and Resomix returns the sounds across the library that share its
     sonic character, wherever they sit in the pack structure.
  2. **How does Resomix fit alongside our existing tags?** It sits beneath them. Tags remain the
     way users describe what they want. Resomix answers the case where they can hear it but cannot
     type it.
  3. **How do we start?** With a private catalogue pilot on a representative sample, or through the
     partner API for a scoped integration into your own product.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.14 DJs `/solutions/djs` (the question where Resomix comes closest to first place)

- Title (unchanged): Find Your Next Track by Sound: Resomix for DJs & Sets
- Description (current, no Resomix): Start from one known record and audition ranked, sonically
  related candidates. Build sets by energy, groove and character, beyond genre tags and charts.
- **Applied description** (154 chars): Resomix is a music discovery tool for DJs. Start from one
  record and audition a ranked shortlist that mixes well, matched on groove, energy and character.
- H1 (unchanged): Find the next track without hours of unfocused digging.
- Opening today, `djs.hero.intro`: "Learning to DJ might not sound that difficult. Becoming a
  great DJ, however, is an entirely different matter." (keep)
- **Applied, prepended to `djs.hero.intro`**, and per the report's M5 it answers the question in
  the question's own words: "Resomix is a music discovery tool for DJs. Pick one track and it
  returns a ranked shortlist of records that sound like it, so you find what to play next without
  hours of digging."
- Brand tie: `journeys.lead1` already says "Resomix's deterministic engine PYXIS-1". No change.
- FAQ, new key `djs.faq`:
  1. **How do DJs find tracks that mix well together with Resomix?** Start from the track you
     know you will play. Resomix ranks candidates by groove, energy and structure, and Track
     Intelligence shows each one's key, Camelot code and BPM, so you can check compatibility before
     you commit. The selection is yours.
  2. **Can I use my own tracks as the reference?** Yes. Upload an MP3, WAV, FLAC or AIFF. It is
     processed privately and deleted no later than 24 hours after upload or analysis.
  3. **Does it only return popular tracks?** No. Results are ranked by measured sound, not by
     charts, release date or play counts, which is how forgotten B-sides come back into sets.
  4. **Can I export a shortlist?** Save the results as a playlist in Resomix and export it to Apple
     Music. (Confirm the export is live on the public app before publishing, see §11.)
  5. **Is Resomix free for DJs?** Free to start in the production beta. A Pro plan adds depth, and
     the plans are compared on the pricing page.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.15 Music Curators `/solutions/music-curators`

- Title (unchanged): Playlist Curation by Sound: Resomix for Music Curators
- Description (current, no Resomix): Move beyond charts and static tags. Start from an audio
  reference and review ranked, sonically related candidates for playlists and editorial programming.
- **Applied description** (157 chars): Resomix is a playlist curation tool for music curators.
  Start from an audio reference and review ranked, sonically related candidates beyond charts and
  tags.
- H1 (unchanged): Curate from the sound, not only the chart.
- Opening today, `musicCurators.hero.intro`: "The art of music curation is born from a unique mix
  of talent and experience…" (keep)
- **Applied, prepended to `musicCurators.hero.intro`**: "Resomix is a music discovery tool
  for curators. One reference track becomes the starting point for a ranked set of tracks that
  share its sound, whatever their genre, era or chart position."
- Brand tie: `rail.lead2` "…PYXIS-1 is designed to discover new connections…" becomes
  "…Resomix's PYXIS-1 engine is designed to discover new connections…".
- FAQ, new key `musicCurators.faq`:
  1. **How do I find songs that fit a playlist's mood?** Pick the track that already has the mood
     and use it as the reference. Resomix returns candidates that share its energy, timbre and
     structure, so the playlist flows by sound rather than by tag.
  2. **Can I save a shortlist?** Yes. Add results to a working shortlist and save it as a playlist
     in Resomix, then keep listening and reviewing from there.
  3. **Does it recommend only what is already popular?** No. Ranking is by measured sonic
     relationship, so a track from another decade or genre can sit next to a recent release when
     they were born from the same feeling.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.16 Producers `/solutions/producers`

- Title (unchanged): Reference & Track Analysis by Sound: Resomix for Producers
- Description (current, no Resomix): Inspect arrangement, energy and timbre in your own recording,
  then explore sonically related references. Evidence for decisions that stay creatively yours.
- **Applied description** (159 chars): Resomix helps producers decode a reference track. Inspect
  arrangement, energy and timbre, then explore sonically related music. The creative decision is
  yours.
- H1 (unchanged): Understand your recording and study the music around it.
- First paragraph today, `producers.hero.support`: "Resomix uses the PYXIS-1 analytical engine to
  examine 70+ musical characteristics…" Already named and tied. Applied prefix: "Resomix is a
  reference-analysis and discovery tool for producers. It uses the PYXIS-1 analytical engine…"
- FAQ, new key `producers.faq`:
  1. **How do I analyse a reference track?** Upload it to Resomix and open Track Intelligence. You
     get structure, energy journey, tempo, key, loudness, timbre and spectral character, each read
     from the audio and shown with confidence where it applies.
  2. **Can I upload my own unfinished track?** Yes. It is processed privately, never used to train
     PYXIS-1, and deleted no later than 24 hours after upload or analysis.
  3. **Does Resomix generate music or tell me what to change?** No. It surfaces relationships and
     evidence. What to study, reinterpret or leave behind stays your decision.
- Schema: `WebPage` plus `Service` plus `FAQPage`.

### 5.17 About `/about`

No changes. The description names Resomix, the body names it 26 times, PYXIS-1 is introduced as
"One proprietary engine, PYXIS-1" in the second sentence, and Thessaloniki is stated (which is
what allows `foundingLocation` in the Organization node).

### 5.18 Pricing `/pricing`, Contact `/contact`, Waitlist `/waitlist`

- `/pricing`: description fine. Its copy lives in the shared billing components and was not part
  of this audit.
- `/contact`: the description still carries the placeholder that `SEO_METADATA_ALL_PAGES.md`
  flagged ("We reply from support@resomix.com within the beta"). **Applied description**, on the
  webapp's mirrored entry too (160 chars): Reach the Resomix team in Thessaloniki for product support, partner and catalogue
  enquiries, or press. Write to support@resomix.com and we will get back to you.
- `/waitlist`: fine.

### 5.19 `/error`, `/404`

`noindex`. Nothing.

---

## 6. llms.txt

Revised text, keeping the current structure. Additions are the buyer phrases, the definition
sentences, and a short "what Resomix is not" block, all facts already on the site.

```
# Resomix

> Resomix is a music similarity search and audio analysis platform for electronic music. Its
> PYXIS-1 engine builds a sonic profile for each recording, so tracks can be found by how they
> sound rather than how they are tagged.

Resomix is a sonic intelligence platform built in Thessaloniki. Pick or upload a reference track
and Sonic Discovery returns ranked matches that belong next to it. Track Intelligence analyses a
single recording for BPM, key, structure, energy, timbre, genre and mood. Catalogue Intelligence
makes an authorised catalogue searchable by sound inside a private index.

## Product

- [Product overview](https://resomix.com/product): One engine and three workflows. Similarity search, track analysis and catalogue search by sound.
- [Sonic Discovery](https://resomix.com/product/sonic-discovery): Music similarity search. One track or upload in, a ranked playlist of similar-sounding tracks out.
- [Track Intelligence](https://resomix.com/product/track-intelligence): Track analysis software. BPM and key detection, structure, energy, loudness, timbre, and genre and mood signals with confidence.
- [Catalogue Intelligence](https://resomix.com/product/catalog-intelligence): Search a music catalogue by sound. Authorised recordings are profiled into a private, partner-scoped index.

## Solutions

- [Record labels](https://resomix.com/solutions/record-labels): Catalogue search by sound for labels and distributors.
- [Music publishers](https://resomix.com/solutions/music-publishers): Find related works across a publishing catalogue by sound.
- [Sync agencies](https://resomix.com/solutions/sync-agencies): Reference-based search for briefs. Clearance stays human.
- [Music libraries and sample providers](https://resomix.com/solutions/music-libraries-sample-providers): Music library search by sound.
- [DJs](https://resomix.com/solutions/djs): Music discovery tool for DJs. Find the next track from one reference.
- [Music curators](https://resomix.com/solutions/music-curators): Playlist curation from a reference track.
- [Producers](https://resomix.com/solutions/producers): Decode a reference track, then explore the music around it.

## Developers and partners

- [Developers](https://resomix.com/developers): Music similarity and audio analysis API for search, similarity by track or upload, and track analysis. Partner-scoped, with no public sandbox.
- [Partners](https://resomix.com/partners): Three ways to work with Resomix. A private pilot, the live API, or integration planning.
- [Guided catalogue pilot](https://resomix.com/partners/pilot): Managed evaluation on your own authorised audio, with the scorecard agreed first.

## Facts

- Resomix is not an audio fingerprinting or song-identification service. It finds and explains
  music by sound. It does not tell you what a recording is.
- Uploaded reference audio is deleted no later than 24 hours after upload or analysis.
- User and partner audio is not used to train or fine-tune PYXIS-1. PYXIS-1 does not generate audio.
- Partner catalogues are logically isolated. There is no shared partner pool and no public sandbox.

## About

- [About Resomix](https://resomix.com/about)
- [Trust, rights and security](https://resomix.com/trust): How audio and data are handled.
- [Pricing](https://resomix.com/pricing)
- [Contact](https://resomix.com/contact)

## Optional

- [The app](https://beta.resomix.com/): The signed-in workspace.
```

---

## 7. Structured data changes

All emitted at build time, per `STRUCTURED_DATA_PLAN.md` §8. Per-route entity configuration lives
in `seoConfig.ts` next to the title (a new optional `entity` field on `RouteSeo`), the generator in
`tooling/prerenderHead.ts`, and `FAQPage` reads the page's `faq` array from its locale JSON.

| Change | Where | Notes |
|---|---|---|
| `Organization`: add `sameAs` (four verified profiles from `packages/config`, empty strings filtered), `contactPoint` (support, partners, legal, privacy), `foundingLocation` Thessaloniki | `apps/landing/index.html` | Already approved in the plan's §2; never shipped |
| `SoftwareApplication` on `/product/sonic-discovery` and `/product/track-intelligence` | `prerenderHead.ts` | `name`, `applicationCategory`, `operatingSystem`, `url` to the beta app, `provider` → Organization, `featureList`. No `offers`, no `aggregateRating` |
| `Service` on `/partners`, `/partners/pilot` and the seven `/solutions/*` | `prerenderHead.ts` | `provider` → Organization, `serviceType`, `areaServed` Worldwide, description reused from `seoConfig` |
| `WebAPI` on `/developers` | `prerenderHead.ts` | `documentation` → api-docs.resomix.com |
| `FAQPage` on every page with a `faq` array, plus `/trust` from `rights.qa` | `prerenderHead.ts` | Generated from the same strings the visible block renders |
| `WebPage.mainEntity` → the route's entity `@id` where one exists | `prerenderHead.ts` | Plan §3 |

Implemented on 17 September 2026, except `SoftwareApplication` and the per-page `FAQPage` blocks,
which wait for George. `structuredData.spec.ts` now asserts a `Service` with a resolving
`provider` on every partner and solutions route, `WebAPI` on the developer overview, `FAQPage` on
the trust page from questions that are visible in the built HTML, no empty `sameAs` entry, and no
`aggregateRating`, `review` or `offers` anywhere.

Expectation to set with George: `FAQPage` no longer produces a Google rich result for commercial
sites. Its value here is for AI assistants, which is the point of this exercise.

---

## 8. Cloudflare (the first thing to do)

Two jobs: prove the AI crawlers get through, and fix the www redirect. Both are dashboard work on
the `resomix.com` zone and need George's access or a screen-share.

### 8.1 Crawler access

1. Security → Bots: the "Block AI bots" (AI Scrapers and Crawlers) switch must be **off**, or set
   to allow. Note the current state before touching it.
2. Security → Bots → Bot Fight Mode / Super Bot Fight Mode: "Verified bots" must be **Allow**.
   "Definitely automated" set to Block will catch any AI crawler that Cloudflare does not list as
   verified. If it is on Block, add a WAF skip rule for the AI user agents rather than switching it
   off globally.
3. AI Crawl Control (formerly AI Audit) in the dashboard: this is the "server logs" Vladimir wants.
   It lists requests per AI crawler over the last days and whether they were allowed. Screenshot it
   for him. Check each of `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`,
   `PerplexityBot`, `Perplexity-User`, `Google-Extended`, `Bingbot` shows allowed traffic, not
   blocked or challenged.
4. Security → Events, filtered by those user agents for the last 30 days: any "Managed Challenge"
   or "Block" rows are the real proof of a problem.
5. The managed `robots.txt` feature ("Manage AI bot traffic with robots.txt") must be **off**; it
   injects disallow lines above the file in the repository.
6. Caching → Configuration: no cache rule should serve a stale prerendered HTML for the routes
   being changed. After deploy, purge the cache for the changed URLs (§12).

### 8.2 www redirect

The report read the homepage on `https://www.resomix.com/`. Today www redirects to the homepage
and drops the path. Replace with a Redirect Rule on the zone:

- When: hostname equals `www.resomix.com`
- Then: dynamic redirect, status 301, expression
  `concat("https://resomix.com", http.request.uri.path)` with "preserve query string" on.

Verify with `curl -I https://www.resomix.com/product/sonic-discovery` (expect 301 to the bare
host with the path intact).

### 8.3 Findings on 17 September 2026

- The zone is on the Free plan. AI bot policies are set to Allow for Search, Agent and Training.
  Bot Preference Sync (the managed robots.txt, now inside the AI bot policies dialog) is off, Bot
  fight mode is off and AI Labyrinth is off. Nothing needed changing.
- No rule for www existed in Redirect Rules or Bulk Redirects, yet www answered 301 to the
  homepage for every path. A new Redirect Rule named "www to apex, keep path" matches
  `http*://www.resomix.com/*` and targets `https://resomix.com/${2}` with the query string
  preserved. Verified live on http and https. Redirect Rules run before Bulk Redirects and Page
  Rules, so the older static redirect is shadowed and can stay where it is.
- The dashboard warned that DNS "may not be proxying traffic for http" when the rule was deployed.
  That is a parsing quirk of the `http*` wildcard. The www record is proxied and the rule applies.
- AI Crawl Control shows no blocked crawler. In the last 24 hours it counted 398 AI crawler
  requests with 362 allowed, and ChatGPT-User, OAI-SearchBot, GPTBot, ClaudeBot, PerplexityBot and
  BingBot all reached the site. The 36 unsuccessful requests are 4xx responses, mostly from
  Meta-ExternalAgent.
- The Optimization tab lists the pages assistants retrieved for answers. The homepage dominates,
  and inner pages appear with a trailing slash, which is the old build layout still on production
  until demo is merged to main.
- Caveat for the proof sent to Vladimir. The user agent probes run from the terminal on
  17 September sit inside that 24 hour window. The Claude-User and Perplexity-User rows, the five
  staging hits and the five Sonic Discovery retrievals are that test traffic, not assistants.
  Retake the screenshots once the window has rolled over.
- The "Homepage, Cache Everything" cache rule is not holding a stale page. Production serves the
  current title with no edge cache status.

---

## 9. One canonical URL (trailing slash)

Cloudflare Pages serves `dist/<route>/index.html` for `/<route>/` and 308-redirects `/<route>` to
`/<route>/`. The canonical, sitemap and internal links all use the bare form. So the URL we
declare as canonical redirects, and the URL assistants actually read is not the canonical.

Recommended fix, in the repository: emit `dist/<route>.html` instead of `dist/<route>/index.html`
in both prerender writers (`tooling/prerenderHead.ts` and `tooling/prerenderBodies.ts`). Pages
then serves the bare URL with 200 and 308-redirects the slashed form to it, which matches the
canonical. `dist/404.html` and the `/auth/*` rewrite are unaffected. Update
`prerenderedHead.spec.ts` for the new file names.

Implemented on 17 September 2026 in both writers and in the six specs that read the built files.
`prerenderedHead.spec.ts` now also fails if the directory form reappears.

Alternative, not taken: switch canonical, sitemap and every internal link to the slashed
form. It touches far more files and Google treats the two forms as different URLs anyway, so the
choice only has to be consistent.

Verify after deploy: `curl -I https://resomix.com/product/sonic-discovery` returns 200;
`curl -I https://resomix.com/product/sonic-discovery/` returns 308 to the bare URL; the page's
`<link rel="canonical">` and `og:url` equal the served URL.

---

## 10. Bing Webmaster Tools and IndexNow

ChatGPT and Copilot ground on Bing's index. Resomix has never been submitted to Bing, which is
consistent with 0% on ChatGPT and a stale www title in the report.

1. Bing Webmaster Tools: add `resomix.com` by importing the verified Google Search Console
   property (one click, no DNS change), then submit `https://resomix.com/sitemap.xml`.
2. IndexNow: the key file already ships at `https://resomix.com/055c65c66919b6a17adda358f79932a7.txt`.
   After each deploy, one POST to `https://api.indexnow.org/indexnow` with `host`, `key`,
   `keyLocation` and the `urlList` of changed URLs. Manual for the first run, as
   `SEO_AND_PERFORMANCE.md` §1.15 decided; wiring it into the deploy can follow once it is proven.
3. Google Search Console: request indexing for the changed URLs after deploy.

---

## 11. Decisions for George before or during the pass

George answered five of these on 17 September 2026, and all five are now implemented locally.

| Question | George's answer | What was done |
|---|---|---|
| FAQ block on the product and solution pages | Approved | One shared `FaqSection` on the four product pages and the seven solution pages, four to six questions each, placed before the closing call to action. `FAQPage` schema is built from the same strings |
| Numbered steps under the Sonic Discovery diagram | Approved, and make it even simpler so it works as an information signal | Five short plain steps under the flow figure, also emitted as `HowTo` schema |
| Reword the beta notice | Yes, change it | The notice now opens "Resomix is a sound-first music discovery and track analysis platform, currently in beta." It is shared, so the app shows it too |
| Publish a catalogue size | Keep it secret | No number anywhere. The FAQ answers about catalogue scale avoid one |
| Switch the Publishers page to British spelling | Yes, make it all British | Eleven words changed on that page. A scan found no American spelling on any other page |

Home, Developers, Partners and the Pilot page also have drafted FAQs in §5, but George's approval
named the product and solution pages, so those four are not built. `SoftwareApplication` on the
two live product pages, the Journal articles and the citation work remain open.

The original list follows for the record.

| Decision | Why it needs George |
|---|---|
| Reword the beta notice to lead with what Resomix is, e.g. "Resomix, the sound-first music discovery platform, is in production beta…" | It is the legal/UX notice on every page of both apps |
| Publish a catalogue-scale figure on Catalogue Intelligence and Developers | `PAGE_BRIEFS.md` forbids catalogue-size numbers; the report says a checkable number is what assistants lead with. If yes, the number and its wording come from George |
| Mention Apple Music export in the DJs FAQ | Only if the export is live for public users |
| `SoftwareApplication` on the two live product pages | Overrides `STRUCTURED_DATA_PLAN.md` §5 for those two pages; rationale in §3.5 |
| American-to-British spelling fixes on the Publishers page | Marco's copy; consistency edit only |
| New Journal articles for the 17 absent questions (report M1) and the citation work on cyanite.ai, GitHub, Reddit, digdeeper.fm and Wikipedia (M6) | Content and PR, not site edits |

---

## 12. Order of work and status

In the order Usman asked for, which was Cloudflare first, then metadata, then the rest.

| Step | What | Files | Status |
|---|---|---|---|
| 1 | Cloudflare checks and www redirect rule (§8) | dashboard | Done. Findings in §8.3 |
| 2 | Descriptions that name Resomix, plus the contact placeholder (§3.2, §5) | `seoConfig.ts`, webapp `seoConfig.ts` | Done, 14 routes |
| 3 | Sonic Discovery hero sentence, plain-text steps and FAQ (§5.3) | `sonicDiscovery.json`, `SdFlowSteps.tsx`, shared FAQ section | Done |
| 4 | Track Intelligence, Catalogue Intelligence, Product and Home copy, and the three product FAQs (§5.1, 5.2, 5.4, 5.5) | four locale files | Done |
| 5 | Developers, Partners and Pilot hero copy (§5.6 to 5.8) | three locale files | Done. Their FAQs are drafted and not approved |
| 6 | Seven solution pages, with the definition sentence prepended to the existing intro, brand ties, FAQs and the Publishers spelling (§5.10 to 5.16) | seven locale files, `sections/shared/FaqSection.tsx` | Done |
| 7 | Structured data (§7) | `index.html`, `seoConfig.ts`, `prerenderHead.ts`, `vite.config.ts`, `structuredData.spec.ts` | Done, except `SoftwareApplication` |
| 8 | Canonical, flat `<route>.html` output in both writers (§9) | two tooling files, six specs | Done. Verified on staging, where the bare URL returns 200 and the slashed form 308 |
| 9 | `llms.txt` (§6) | `public/llms.txt` | Done |
| 10 | Build and the seven build-output specs | | Done. 121 tests pass |
| 11 | Production release from demo to main, then Bing, IndexNow and Search Console (§10) | | After the release |
| 12 | Verify (§13) and send Vladimir the go-live date and the changed URLs | | After the release |

George reviewed the visible changes on 17 September 2026 and Usman checked the design on every
touched page before the push.

---

## 13. Verification and hand-off

After deploy, for each changed URL:

1. `curl -sI` the bare URL: 200, no redirect. The slashed form: 308 to bare. www: 301 to bare with
   the path kept.
2. `curl -s` the bare URL and confirm, in the raw HTML with no JavaScript: the definition sentence
   under the H1, the FAQ questions, the steps list on Sonic Discovery, the meta description
   containing "Resomix", the `FAQPage` and entity JSON-LD.
3. Google Rich Results Test and the Schema Markup Validator on the built HTML of `/`,
   `/product/sonic-discovery`, `/product/track-intelligence`, `/solutions/djs`, `/developers`.
4. Ask the five buyer questions Resomix loses hardest on ChatGPT, Claude, Gemini and Grok, and
   note the sources each cites. That list is the target for the report's M4 and M6 and is George's
   follow-up, not a site edit.
5. Send Vladimir: go-live date, the full list of changed URLs (all twenty indexable routes plus
   `llms.txt`), the Cloudflare AI Crawl Control screenshot, and the note that www and trailing-slash
   canonicals were fixed. He re-runs 2 to 3 weeks later against the 15 September baseline.
