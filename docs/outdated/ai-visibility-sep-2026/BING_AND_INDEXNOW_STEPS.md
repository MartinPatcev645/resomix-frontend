# Bing Webmaster Tools and IndexNow

Written 17 September 2026, revised 18 September. This is step 7 of Vladimir's list and the last open
item of the AI visibility work. ChatGPT and Copilot search through Bing, and resomix.com has never
been registered there.

## Where things stand

Checked on 18 September 2026.

| | State |
|---|---|
| resomix.com, production | **Still the old build.** `/product/sonic-discovery` answers 308, which is the very redirect the release fixes |
| The IndexNow key file on production | Live and correct at `https://resomix.com/055c65c66919b6a17adda358f79932a7.txt` |
| api-docs.resomix.com | Rebuilt but **not yet deployed** |
| Sitemaps | resomix.com, api-docs.resomix.com and blog.resomix.com all answer 200 |

So **Part 1 can be done right now**. Parts 2 and 3 wait for their releases, because submitting
earlier just makes Bing re-read the old pages and burns the one strong signal we get.

Three sites are involved. Bing treats every subdomain as its own property, so resomix.com,
api-docs.resomix.com and blog.resomix.com each have to be added separately.

---

## Part 1. Register the sites. Do this now

### 1a. resomix.com

1. Open `https://www.bing.com/webmasters` and sign in. Use the Google account that has Search
   Console access to resomix.com, because that makes the next step one click. If only George has
   that access, do this with him or use step 5 instead.
2. On the welcome screen there are two boxes. In the one for Google Search Console, click
   **Import**, then **Continue**.
3. Choose the Google account and allow Bing to view the Search Console data and verified sites.
   This is read-only access.
4. Tick `resomix.com` in the list and click **Import**. Bing copies the verification and the
   sitemap across, so there is nothing to verify by hand. Skip to step 6.
5. Only if the import is not possible. In the other box type `https://resomix.com` and click
   **Add**. Choose **Add CNAME record to DNS**. Bing shows a record name, which is a long string of
   letters and numbers, and the value `verify.bing.com`. In Cloudflare go to **DNS**, **Records**,
   **Add record**, set the type to CNAME, paste the name and the value, switch the proxy to
   **DNS only** so the cloud is grey, and save. Back in Bing click **Verify**.
6. In the left menu click **Sitemaps**. If `https://resomix.com/sitemap.xml` is already listed,
   this part is done. If not, click **Submit sitemap**, paste that address and click **Submit**.

### 1b. api-docs.resomix.com

Worth doing properly. This is the page that should answer "best audio analysis API for music", the
question where Resomix appears in 0 of 25 answers, and until this week it had nothing readable on it
at all.

1. In Bing Webmaster Tools, top left, click the site name, then **Add site**.
2. Type `https://api-docs.resomix.com` and click **Add**.
3. Choose **Add CNAME record to DNS** and add the record in Cloudflare exactly as in step 5 above,
   proxy set to **DNS only**.
4. Click **Verify**.
5. Go to **Sitemaps**, **Submit sitemap**, and paste `https://api-docs.resomix.com/sitemap.xml`.

### 1c. blog.resomix.com

Same five steps as 1b, with `https://blog.resomix.com` and its own sitemap. This one is George and
Marco's, so check with them before adding it.

Bing takes up to 48 hours to show data for a new site. That is normal, and nothing is wrong if the
dashboard is empty the next morning.

---

## Part 2. After resomix.com goes to production

### 1. Confirm production is on the new build

This must print `200`. While it prints `308`, the release has not landed and the rest of this part
must wait.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://resomix.com/product/sonic-discovery
```

### 2. Confirm the questions blocks are actually live

Should print a number well above zero. It counts the pages that now carry a questions section.

```bash
for u in / /about /pricing /developers /partners /partners/pilot /product /product/sonic-discovery /product/track-intelligence /product/catalog-intelligence /trust /solutions/record-labels /solutions/music-publishers /solutions/sync-agencies /solutions/music-libraries-sample-providers /solutions/djs /solutions/music-curators /solutions/producers; do curl -s "https://resomix.com$u" | grep -q 'FAQPage' && echo "ok   $u" || echo "MISS $u"; done
```

### 3. Send the IndexNow notification

The key file already ships with the site and is live. One submission reaches Bing and every other
engine in the scheme. It covers all 20 sitemap pages plus llms.txt, because every page's HTML
changed. It should print `200` or `202`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" -d '{"host":"resomix.com","key":"055c65c66919b6a17adda358f79932a7","keyLocation":"https://resomix.com/055c65c66919b6a17adda358f79932a7.txt","urlList":["https://resomix.com/","https://resomix.com/about","https://resomix.com/product","https://resomix.com/product/sonic-discovery","https://resomix.com/product/track-intelligence","https://resomix.com/product/catalog-intelligence","https://resomix.com/developers","https://resomix.com/partners","https://resomix.com/partners/pilot","https://resomix.com/trust","https://resomix.com/solutions/record-labels","https://resomix.com/solutions/music-publishers","https://resomix.com/solutions/sync-agencies","https://resomix.com/solutions/music-libraries-sample-providers","https://resomix.com/solutions/djs","https://resomix.com/solutions/music-curators","https://resomix.com/solutions/producers","https://resomix.com/pricing","https://resomix.com/contact","https://resomix.com/waitlist","https://resomix.com/llms.txt"]}'
```

A `403` means the key file was not reachable. A `422` means a URL did not match the host.

### 4. Check Bing accepted it

A few minutes later, in Bing Webmaster Tools click **IndexNow** in the left menu. The submitted URLs
should be listed there.

### 5. Inspect the page the report singled out

Click **URL Inspection**, paste `https://resomix.com/product/sonic-discovery`, click **Inspect**. It
shows whether Bing can fetch the page and what it sees.

### 6. Nudge Google separately

Google does not take part in IndexNow. In Google Search Console use **URL Inspection**, then
**Request indexing**, on the five pages that matter most: the homepage, Sonic Discovery, Track
Intelligence, DJs and Developers. Google limits these to roughly ten a day.

### 7. Tell Vladimir

Send the go-live message with the list of changed pages, which is at the end of
`AI_VISIBILITY_SUMMARY.md`. He re-runs his test two to three weeks later.

---

## Part 3. After api-docs.resomix.com is deployed

Its nine pages were, until this week, one page as far as any crawler was concerned, all
canonicalised to the hub's home page. Once the new build is live they are nine real pages, and Bing
should be told to look again.

### 1. Confirm the new build is live

The first must print `200` and the second must print `404`. A `200` on the second means the old
behaviour is still in place and the rest of this part must wait.

```bash
curl -s -o /dev/null -w "quickstart: %{http_code}\n" https://api-docs.resomix.com/quickstart && curl -s -o /dev/null -w "made-up path: %{http_code}\n" https://api-docs.resomix.com/this-path-does-not-exist
```

### 2. Confirm each page now stands on its own

Every line should show a different canonical, ending in its own path rather than in the bare
hostname.

```bash
for p in "" api-ref playground introduction onboarding ingestion-requirements quickstart authentication rate-limits; do printf "%-26s " "/$p"; curl -s "https://api-docs.resomix.com/$p" | grep -o 'rel="canonical" href="[^"]*"' | head -1; done
```

### 3. Send the IndexNow notification for the hub

A key file with the same key now ships with the hub as well, so one submission covers it. Should
print `200` or `202`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" -d '{"host":"api-docs.resomix.com","key":"055c65c66919b6a17adda358f79932a7","keyLocation":"https://api-docs.resomix.com/055c65c66919b6a17adda358f79932a7.txt","urlList":["https://api-docs.resomix.com/","https://api-docs.resomix.com/api-ref","https://api-docs.resomix.com/playground","https://api-docs.resomix.com/introduction","https://api-docs.resomix.com/onboarding","https://api-docs.resomix.com/ingestion-requirements","https://api-docs.resomix.com/quickstart","https://api-docs.resomix.com/authentication","https://api-docs.resomix.com/rate-limits","https://api-docs.resomix.com/llms.txt"]}'
```

### 4. Re-submit the sitemap

In Bing Webmaster Tools, on the api-docs.resomix.com property, open **Sitemaps** and click the
refresh or resubmit control next to `https://api-docs.resomix.com/sitemap.xml`. The file is now
generated from the route list rather than hand-written.

### 5. Inspect one guide

**URL Inspection** on `https://api-docs.resomix.com/quickstart`. Before this release Bing would have
seen an empty page with the home page's title. It should now see the quickstart's own title and its
text.

---

## After every later release

Step 3 of Part 2 is worth repeating whenever page copy changes. Trim the list to the pages that
actually changed. Nothing pings automatically, by design, because it notifies outside services and
that should be a decision each time.
