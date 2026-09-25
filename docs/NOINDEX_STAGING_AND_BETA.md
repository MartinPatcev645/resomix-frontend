# Keeping staging out of search, and the beta decision

Written 23 September 2026, after staging pages were found in search results.

## What is exposed today

Checked live on 23 September.

| Host | What it serves | robots.txt | Robots tag | Canonical |
|---|---|---|---|---|
| `staging-landing.resomix.com` | the marketing build | the production file, `Allow: /` | `index, follow` | points at `resomix.com` |
| `staging-frontend.resomix.com` | the webapp build | the beta file, `Allow: /` | `index, follow` | itself |
| `staging-admin.resomix.com` | the admin build | **none.** Every path answered 200 with the app's HTML, `/robots.txt` included | none at all | none |
| `beta.resomix.com` | the webapp build, production | `Allow: /` | `index, follow` | itself |

Two things follow from that table. Every staging host is fully crawlable, and the admin one was the
worst of the three because a crawler reading `/robots.txt` got the app shell back with a 200 and
treated the whole host as open.

Note that a staging host shares its build with production, so nothing in the build can tell them
apart. `staging-landing` serves the same files as `resomix.com` and `staging-frontend` the same
files as `beta.resomix.com`. That is why the fix for those two is a rule at the edge, not a file in
the repository.

## 1. The rule that does the work

Cloudflare, `resomix.com` zone, **Rules**, **Transform Rules**, **Modify Response Header**, Create
rule. Name it "Staging is never indexed".

Use **Edit expression** rather than the visual builder, the same way the Markdown rules were made.

```
http.host in {"staging-landing.resomix.com" "staging-frontend.resomix.com" "staging-admin.resomix.com"}
```

Action: **Set static**, header name `X-Robots-Tag`, value:

```
noindex, nofollow
```

That header outranks anything in the page and applies to files that have no head to put a tag in.
Add any other staging hostname to the same list as it appears.

**Leave crawling allowed.** A host blocked in robots.txt is never fetched, so the noindex is never
read, and a URL already in an index stays there as a bare link. The crawl has to happen for the page
to be removed.

### Verifying

Each of these must print the header:

```bash
for h in staging-landing staging-frontend staging-admin; do printf "%-18s " "$h"; curl -sI "https://$h.resomix.com/" | grep -i x-robots-tag || echo "MISSING"; done
```

And production must be untouched, so this must print nothing:

```bash
curl -sI https://resomix.com/ | grep -i x-robots-tag
```

## 2. The admin app, fixed in the repository

`apps/admin` now ships `public/robots.txt` and a `noindex, nofollow` tag in `index.html`. The admin
app is internal on every host, so this belongs in the build rather than in a rule, and it covers any
future host as well.

The robots.txt allows crawling on purpose, for the reason above. Once the admin URLs are out of the
index it can be switched to `Disallow: /`.

## 3. Removing what is already indexed

The rule stops new indexing. It does not remove what is already there, which needs one pass per
search engine.

**Google.** Search Console has a Removals tool. If `resomix.com` is verified as a **domain**
property, it covers every subdomain, so no new property is needed. Removals, New request, Remove all
URLs with this prefix, `https://staging-frontend.resomix.com/`, then the same for the other two
hosts. That hides them for six months, and the noindex header makes it permanent.

**Bing.** Webmaster Tools treats each subdomain as its own site, so a staging host has to be added
and verified before its URLs can be blocked, under Configure My Site, Block URLs. Worth doing only
for a host that actually appears in Bing.

To find what is indexed, search `site:staging-frontend.resomix.com` on each engine, and the same for
the other two hosts.

## 4. Beta is a service, decided 23 September

§16 of `AI_VISIBILITY_CONTENT_AUDIT.md` put a choice to George, because `beta.resomix.com` was
indexable and its `/sonic-discovery` competed with `resomix.com/product/sonic-discovery` for the
query the September work was written to win.

**His answer: treat beta as a service.** The sign-in page may be in search, since that is the way
in and what someone searching for it wants. Nothing behind it belongs there.

Applied in `apps/webapp`:

| Change | Where |
|---|---|
| `/`, `/sonic-discovery` and `/analysis` are now `noindex` | `src/routes/seoConfig.ts` |
| `/auth/login` is the one indexable route, with a description written for a search result | `src/routes/seoConfig.ts` |
| The shell's default is `noindex, follow`, so an unknown path is never a result either | `index.html` |
| The generated sitemap now lists exactly one URL, `/auth/login` | built from the same config |
| robots.txt still allows crawling, and says why | `public/robots.txt` |
| Both SEO specs assert the new shape | `src/test/routeSeo.spec.tsx`, `src/test/prerenderedHead.spec.ts` |

No canonical to the marketing pages alongside a noindex. The two together contradict each other, and
that reasoning was already written into the spec file.

The `beta.resomix.com` sitemap can stay registered in Bing. It now advertises the one page that is
still meant to be found.

**This reaches production with the next `demo` to `main` release.** Until then beta still serves
`index, follow`, while `staging-frontend` is already covered by the rule in section 1. Once it is
live, the three old URLs can be cleared faster with a removal request in Google and Bing rather than
waiting for a natural re-crawl.
