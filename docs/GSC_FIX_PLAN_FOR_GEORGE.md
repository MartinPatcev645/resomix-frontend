# Google Search Console clean-up plan

1 October 2026

## Update, 2 October 2026

Section 1 below was written from Search Console's own report, exported on 1 October. That report
turned out to be several days behind reality, so the picture it painted was worse than the truth.

On 2 October we checked every page one by one against Google's live index rather than the report.
Google had quietly been working through our pages since the 18 September release and the report had
not caught up. In particular, all four pages that Google had previously looked at and turned down
are now in Google.

Twelve of our twenty main pages are in Google, not four. Alongside the home page, pricing, contact
and the waitlist, that is Product, Sonic Discovery, Track Intelligence, Producers, Record Labels,
Music Libraries and Sample Providers, Trust, and the Private Catalogue Pilot.

Eight marketing pages are still missing, along with the developer hub. Every one of them has now
been submitted to Google, which is the work this plan describes. We are waiting on Google from here.

Nothing about the plan or the estimate changes. The problem is simply smaller than the report made
it look, and the September release worked better than it appeared.

## 1. Why We Are Doing This (The Cause)

We rewrote 16 pages in September so that Google and AI assistants would understand what Resomix is.
Checking Google Search Console now, almost none of that work is visible, and the reason is simple.

**Google has never looked at most of our pages.** Twelve of them, including every Solutions page,
both Product pages, Developers, Partners and About, are sitting in a queue marked "discovered, not
yet visited". Four more were visited but not added to the index. So 16 of our 20 main pages are not
in Google at all. Only the home page, pricing, contact and the waitlist are.

That explains the rest of what we see. In the last 28 days the site got 36 clicks, and every single
one came from somebody typing "resomix" into Google. Nobody found us by searching for what we do,
because the pages that describe what we do are not in the index to be found.

Two other things need attention. Our internal test site, `staging-landing.resomix.com`, is showing
up in Google search results. And two old addresses, `/terms` and `/privacy`, are dead links that
Google still has on file.

## 2. What Will Be Done

**Get our pages into Google**

- Ask Google directly to visit each of the 16 missing pages. There is a daily limit, so this is
  done over two days.
- Check the four pages Google visited but chose not to keep, and find out what put it off.

**Take the test site out of search**

- Submit a removal request for the test site so it disappears from results now, rather than waiting
  months for Google to drop it on its own.
- Do the same for one old address that was replaced earlier in the year.

**Tidy the dead links**

- Confirm nothing on the site still points at `/terms` and `/privacy`, and let Google drop them.
- Report one broken link we found on the blog, where a placeholder was published instead of the
  real Instagram address. The blog is not ours to edit, so this goes to whoever maintains it.

**Set up measurement**

- Write down today's numbers so we can prove whether this worked. Right now that is 36 clicks,
  218 impressions, 53 pages indexed, and one non-brand search in the entire month.
- Re-check in two weeks.

## ⚠️ Two things you should know before approving

**Google decides, we can only ask.** Requesting indexing is a request, not a command. Pages
normally appear within days, but Google is free to decline, and a page it declines twice usually
has a content reason behind it rather than a technical one. If that happens on the Solutions pages
we will come back to you with what we found.

**This fixes reach, not ranking.** Once the pages are in the index they can start appearing for
searches about music discovery and catalogue analysis. Where they rank is a separate question and a
longer piece of work, because the site currently has only three genuine links from other websites
pointing at it. That is the main thing holding ranking back, and it is not something a technical fix
solves.

## 3. Original Estimates

Implementation Estimate: 1h - 1.5h

Testing Estimate: 0.5h

Total Task Estimate: 1.5h - 2h

## 🛑 New Findings (Pending Approval)

**Found During Implementation**

- Issue: Our sitemap tells Google that all 20 pages changed today, every time we deploy. The date is
  generated at the moment of the build rather than being a real date per page. Google uses that date
  to decide which pages are worth re-visiting, and it stops trusting the date once it notices it
  moves while the pages themselves do not. This is a likely reason Google has been slow to visit
  some pages, and why Bing has not re-checked the Developers page since 6 September. The fix gives
  each page its own date, changed only when that page actually changes, plus a check that stops a
  deploy if a date is missing or set in the future.
- Fix Estimate: 0.5h - 1h
- Status: Done and live. Each page now carries a real date of its own, and the build refuses to
  publish a sitemap if a date is missing or wrong, so this cannot drift back.

**Found During Testing**

- Issue: todo
- Fix Estimate: todo
- Status: todo

## 📌 A note on estimates

> Estimates are my best judgement based on similar work I've done. Actual time may come in
> below or above them depending on what the code reveals. I always bill actual time worked,
> not the estimate, and if a task is heading meaningfully over, I'll flag it before
> continuing, not after.

---

## Appendix — the full list, for the record

Exported from Search Console on 1 October 2026. Source files are in
`AA_Resomix_Docs/Resomix/GSP-SEO`.

**Discovered, not yet visited by Google (23)**

Our pages: `/about`, `/developers`, `/partners`, `/product`, `/product/catalog-intelligence`,
`/product/sonic-discovery`, `/solutions/djs`, `/solutions/music-curators`,
`/solutions/music-libraries-sample-providers`, `/solutions/music-publishers`,
`/solutions/record-labels`, `/solutions/sync-agencies`.

Also: all seven api-docs pages, two beta pages we have deliberately hidden, and three blog tag
pages.

**Visited but not kept (11)**

Our pages: `/trust`, `/partners/pilot`, `/solutions/producers`, `/product/track-intelligence`.

Also: the test site home page, the old `landing.resomix.com` and its waitlist, the blog's RSS feed
and three old blog addresses.

**Redirects (20)** — all expected. The `http` to `https` and `www` versions of the home page, old
`/blog/...` addresses that now point at the real blog, and support-site addresses that moved.

**Page not found (3)** — a deleted blog tag, a Cloudflare email-protection address that is normal,
and the blog's contact page placeholder `REPLACE_INSTAGRAM_URL`.

**Duplicate addresses (6)** — all carrying a `?ref=` tracking tag from the blog. Working as
intended, Google is correctly ignoring the duplicates.

**Soft 404 (2)** — `/terms` and `/privacy`, replaced by `legal.resomix.com` earlier this year.

**Blocked by robots.txt: 0.** Nothing on the site is blocking Google.
