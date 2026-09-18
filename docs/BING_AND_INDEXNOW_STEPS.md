# Bing Webmaster Tools and IndexNow

Written 17 September 2026. This is step 7 of Vladimir's list and the last open item of the AI
visibility work. ChatGPT and Copilot search through Bing, and resomix.com has never been
registered there.

Part 1 can be done at any time. Part 2 must wait until resomix.com serves the new build, because
submitting earlier makes Bing re-read the old pages.

## Part 1. Register the site

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
7. Optional but worth it. Repeat step 4 or 5 for `blog.resomix.com`. Bing treats a subdomain as
   its own site, and the Journal is where new articles will live.

Bing takes up to 48 hours to show data for a new site. That is normal.

## Part 2. After the production release

1. Confirm production is on the new build. This must print 200, not 308.

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://resomix.com/product/sonic-discovery
```

2. Send the IndexNow notification. The key file already ships with the site at
   `https://resomix.com/055c65c66919b6a17adda358f79932a7.txt`. One submission reaches Bing and
   every other engine in the scheme. It covers all 20 sitemap pages plus llms.txt, because every
   page's HTML changed. It should print 200 or 202.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" -d '{"host":"resomix.com","key":"055c65c66919b6a17adda358f79932a7","keyLocation":"https://resomix.com/055c65c66919b6a17adda358f79932a7.txt","urlList":["https://resomix.com/","https://resomix.com/about","https://resomix.com/product","https://resomix.com/product/sonic-discovery","https://resomix.com/product/track-intelligence","https://resomix.com/product/catalog-intelligence","https://resomix.com/developers","https://resomix.com/partners","https://resomix.com/partners/pilot","https://resomix.com/trust","https://resomix.com/solutions/record-labels","https://resomix.com/solutions/music-publishers","https://resomix.com/solutions/sync-agencies","https://resomix.com/solutions/music-libraries-sample-providers","https://resomix.com/solutions/djs","https://resomix.com/solutions/music-curators","https://resomix.com/solutions/producers","https://resomix.com/pricing","https://resomix.com/contact","https://resomix.com/waitlist","https://resomix.com/llms.txt"]}'
```

   A 403 means the key file was not reachable. A 422 means a URL did not match the host.

3. In Bing Webmaster Tools click **IndexNow** in the left menu a few minutes later. The submitted
   URLs should appear there, which confirms Bing accepted the key.
4. Click **URL Inspection**, paste `https://resomix.com/product/sonic-discovery` and click
   **Inspect**. It shows whether Bing can fetch the page and what it sees. This is the page the
   report singled out, so it is the one to confirm.
5. Google does not take part in IndexNow. In Google Search Console use **URL Inspection**, then
   **Request indexing**, on the five pages that matter most. The homepage, Sonic Discovery, Track
   Intelligence, DJs and Developers. Google limits these to roughly ten a day.
6. Send Vladimir the go-live message with the list of changed pages, which is at the end of
   `AI_VISIBILITY_SUMMARY.md`. He re-runs his test two to three weeks later.

## After every later release

Step 2 of Part 2 is worth repeating whenever page copy changes. Trim the list to the pages that
changed. Nothing pings automatically, by design, because it notifies outside services.
