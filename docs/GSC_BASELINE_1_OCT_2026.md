# Google Search Console, state on 1 October 2026

Everything below is read off the console on 1 Oct 2026. The performance window is the last 28 days,
roughly 1 to 28 September, so it **straddles the 18 September release** and only about ten days of
it are post-release. Treat it as the baseline to measure against, not as a verdict on the work.

---

## 1. Performance, last 28 days

| | |
|---|---|
| Clicks | **36** (up 20%) |
| Impressions | **218** (up 25%) |
| Average CTR | 16.5% |
| Average position | 13.9 |

### Queries, all nine of them

| Query | Clicks | Impressions |
|---|---|---|
| resomix | 36 | 73 |
| reomix | 0 | 37 |
| resomix.com | 0 | 5 |
| remosic | 0 | 2 |
| resom | 0 | 2 |
| resiolomix | 0 | 1 |
| sound curation | 0 | 1 |
| solomix | 0 | 1 |
| resomi | 0 | 1 |

**Every click comes from someone typing the brand name.** Eight of the nine queries are the brand or
a misspelling of it. The only non-brand query in the whole set is "sound curation", with one
impression and no click.

### Pages, top 10 of 59

| Page | Clicks | Impressions |
|---|---|---|
| resomix.com/ | 35 | 129 |
| resomix.com/pricing/ | 1 | 48 |
| blog.resomix.com/ | 0 | 90 |
| support.resomix.com/ | 0 | 55 |
| blog.resomix.com/introducing-resomix-music-discovery-reimagined/ | 0 | 49 |
| resomix.com/contact | 0 | 46 |
| blog.resomix.com/who-resomix-is-for/ | 0 | 38 |
| resomix.com/waitlist/ | 0 | 36 |
| support.resomix.com/hc/articles/5/f-a-q | 0 | 28 |
| **staging-landing.resomix.com/about** | 0 | **24** |

### Countries

Greece 31%, Italy 8%, Macedonia 8%, United States 6%, Argentina 3%.

### Achievements, which carry history the 28-day view hides

- In progress: 36 of 90 clicks in 28 days.
- Achieved **80 clicks in 28 days on 16 May 2026**, and 70 on 12 May.

So the site was doing more than twice today's click volume in May.

---

## 2. Generative AI features (Beta), last 28 days

**50 impressions.** No clicks column exists on this report. The daily line is spiky, zero on many
days, with the highest single day at the very end of the window, around 10 to 11 on 28 September.

Top pages, 10 of 17:

| Page | Impressions |
|---|---|
| resomix.com/ | 36 |
| blog.resomix.com/how-to-find-new-techno-music/ | 9 |
| blog.resomix.com/introducing-resomix-music-discovery-reimagined/ | 5 |
| blog.resomix.com/ambient-music-for-sleep-no-beat-no-melody/ | 3 |
| support.resomix.com/hc/articles/5/f-a-q | 3 |
| blog.resomix.com/the-story-behind-resomix/ | 2 |
| blog.resomix.com/why-is-resomix-different/ | 2 |
| blog.resomix.com/ | 1 |
| blog.resomix.com/how-your-labels-back-catalogue-becomes-a-reliable-revenue-stream/ | 1 |
| blog.resomix.com/tag/track-intelligence/ | 1 |

The per-page figures add to more than the 50 headline, which is normal for this report. The useful
reading is the ranking, not the arithmetic.

**The blog is carrying this surface.** Six of the ten are blog posts, and the single best non-home
page is a how-to article, not a product page.

---

## 3. Indexing

**53 indexed, 70 not indexed, across 8 reasons.** The total has climbed through the quarter, from
about 48 pages in early July to about 123 now.

| Reason | Source | Validation | Pages |
|---|---|---|---|
| Discovered, currently not indexed | Google systems | Started | 24 |
| Page with redirect | Website | Started | 21 |
| Crawled, currently not indexed | Google systems | **Failed** | 12 |
| Alternate page with proper canonical tag | Website | Not started | 6 |
| Not found (404) | Website | Not started | 3 |
| Soft 404 | Website | Started | 2 |
| Excluded by 'noindex' tag | Website | Not started | 1 |
| Duplicate, Google chose a different canonical | Google systems | Not started | 1 |
| Blocked by robots.txt | Website | n/a | **0** |

Blocked by robots.txt at zero is the one number here that is exactly right, and it is the one the
Content Signals work depended on.

---

## 4. Sitemaps, all eight reading Success

| Sitemap | Submitted | Last read | Pages |
|---|---|---|---|
| resomix.com/sitemap.xml | 4 Aug 2026 | 30 Sep | 20 |
| blog.resomix.com/sitemap.xml (index) | 18 Sep | 27 Sep | 26 |
| blog sitemap-posts / pages / tags / authors | 18 Sep | 25 to 30 Sep | 9 / 9 / 5 / 3 |
| api-docs.resomix.com/sitemap.xml | 18 Sep | 26 Sep | 9 |
| beta.resomix.com/sitemap.xml | 18 Sep | 30 Sep | **1** |

Beta reading 1 page confirms the "treat beta as a service" decision reached Google. All eight are
being re-read regularly, so discovery is not the bottleneck.

---

## 5. Removals

One request ever, and it has lapsed.

| URL | Type | Requested | Status |
|---|---|---|---|
| https://landing.resomix.com/ | Temporarily remove URL | 3 Aug 2026 | **Removal expired** |

Nothing has been requested for `staging-landing`, `staging-frontend`, `staging-admin` or the old
beta URLs.

---

## 6. The clean reports

**HTTPS.** 13 HTTPS URLs, 0 non-HTTPS, no issues in 90 days.

**Structured data.** 9 valid items, 0 invalid, no issues in 90 days. The count has climbed since
8 August and stepped up again at the end of September. Nine is well short of the 18 pages carrying
FAQPage, so this report is one specific type rather than all of them. Worth opening to see which.

**Core Web Vitals.** No data at all, mobile or desktop, "not enough usage data in the last 90 days",
source Chrome UX report, last updated 29 September. The site does not have the traffic to generate
field data, so CWV cannot be measured or acted on yet.

---

## 7. Links

**External links, 7 in total.**

| Linking site | Links |
|---|---|
| ghost.org | 4 |
| linkedin.com | 2 |
| webcraft.company | 1 |

The four from ghost.org are the blog platform's own footer attribution, so the real count of earned
links is closer to three.

**Internal links, 155.** Home 32, blog 27, legal 26, contact 24, support 15. The product and
solutions pages barely appear; `solutions/producers` has 8 and nothing else from that group is in
the top ten.
