# Agent Readiness Check for resomix.com

Prepared for George on 17 September 2026.
The source is Cloudflare's new Diagnostics scan, found under AI Crawl Control, Optimization,
"Check your site". It was run on resomix.com on 17 September 2026.

## What this check is

Cloudflare now grades how ready a website is for AI agents. It runs 21 checks in four groups and
gives each group a level.

This is a different question from the one Vladimir's report answers. Vladimir measured whether
assistants name Resomix when someone asks them for a music similarity tool. This scan measures
whether an AI agent that arrives at resomix.com can find its way around, read our pages cheaply
and discover that we have an API. The first is won with content and citations, which is the work
already under way. The second is mostly a handful of small technical files, and it is cheap.

Both are worth doing. This one will not move the share of voice number on its own, but it removes
every technical excuse an assistant could have for skipping us.

## Where we stand today

| Group | Level | Score |
|---|---|---|
| Quick Wins | Level 1 | 3 of 5 |
| Technical Groundwork | Level 2 | 0 of 3 |
| Advanced Integration | Level 3 | 0 of 8 |
| Commerce | Optional, not scored | 0 of 5 |

## What already passes

| Check | Result |
|---|---|
| robots.txt (marked high impact) | Exists and is valid |
| sitemap.xml (marked high impact) | Exists and is valid |
| AI crawler rules | No AI crawler is blocked |

The same day we confirmed the rest of the Cloudflare setup by hand. The AI bot policies are set to
Allow for search, agent and training bots. Bot fight mode is off. In the last 24 hours Cloudflare
counted 398 requests from AI crawlers and served 362 of them, including ChatGPT, Claude, Perplexity
and Bing. Access was never the reason Resomix went unnamed in the report.

We also fixed one real fault. Every link on www.resomix.com used to land on the homepage, whatever
page it pointed at. It now redirects to the same page on resomix.com.

## Every item up to Level 2, what it needs and how long

Level 1 is the five Quick Wins, Level 2 the three Technical Groundwork items. Nothing below needs
the paid Cloudflare plan, and nothing changes how the pages look.

| Item | What turns it green | Where | Time |
|---|---|---|---|
| robots.txt | Already green. The file exists, is valid and blocks no AI crawler | `apps/landing/public/robots.txt` | Done |
| Sitemap | Already green. Built from the route list on every deploy | generated into `sitemap.xml` from `apps/landing/src/routes/seoConfig.ts` | Done |
| AI crawler rules | Already green. Search, agent and training bots are all set to allow, and no crawler is blocked | Cloudflare, Security Settings and AI Crawl Control | Done |
| Content Signals | **Done 18 Sep.** One line under `User-agent: *`, all three values yes | `apps/landing/public/robots.txt` | Done |
| Markdown for agents | Serve a plain-text version of each page when an agent asks for one. Cloudflare's own switch needs the Pro plan, so we build it. A build step writes a Markdown copy of every page, and a small Cloudflare Pages function returns it when the request asks for Markdown | new `apps/landing/functions/_middleware.ts` plus a new build step beside `tooling/prerenderBodies.ts` | 1 to 2 h |
| API catalogue | **Done 18 Sep.** Linkset naming the Partner API with six documentation links, plus author, terms and the pilot route | `apps/landing/public/.well-known/api-catalog` plus a rule in `_headers` | Done |
| Link headers | **Done 18 Sep.** Three relations on every response, `api-catalog`, `sitemap` and `alternate` for llms.txt | `apps/landing/public/_headers`, added to the existing block | Done |
| auth.md | **Done 18 Sep.** Written from copy already on the site, and states plainly that an agent cannot complete a sign-up | `apps/landing/public/auth.md` | Done, wording still to be checked against the Terms |
| Rescan and verify | Re-run the Cloudflare scan and check each item reports green. Needs the deploy first | Cloudflare, AI Crawl Control, Optimization | 10 min, pending deploy |

**Total 2.5 to 3.5 hours**, which takes Level 1 to 5 of 5 and Level 2 to 3 of 3. Without the
Markdown item it is about 1.5 hours, and the score becomes Level 1 at 4 of 5 with Level 2 complete.

These are clean-run times. If any item does not report green on the first rescan, add a little for
troubleshooting, most likely on the Markdown item, since it is the only one that introduces new
moving parts.

All three decisions were answered on 18 September and the four items they gated are built. What is
left is the rescan, which needs a deploy first, and the Markdown item, which is being done on its
own afterwards for the reason in the next section.

## What is missing at Level 1

### 1. Content Signals

This is one line in robots.txt that states how automated systems may use our content. It has three
parts. The first covers search results, the second covers AI assistants using a page to answer a
question, and the third covers training AI models.

We add the line ourselves in the robots.txt we already ship. The recommended line is below.

```
Content-Signal: search=yes, ai-input=yes, ai-train=yes
```

The first two should be yes without question, because they are exactly the visibility we are
working for. The third is your decision. I recommend yes. Training is how an assistant comes to
know a brand without having to search for it, and this line is only about the pages of the public
website. It has nothing to do with the audio people upload, so the promise on the Trust page is
untouched.

### 2. Markdown for agents

An agent can ask for a page as plain Markdown instead of HTML, which is far cheaper for it to read.
Cloudflare offers this as a switch, but only on the Pro plan, which we are not taking.

We can build the same behaviour ourselves on the free plan. The site already produces a full copy
of every page at build time, so we generate a Markdown version alongside it and serve that version
when an agent asks for it. This is the largest item on the list.

## What is missing at Level 2

### 1. API catalogue

A small file at `/.well-known/api-catalog`, following a published internet standard (RFC 9727),
that tells an agent Resomix has an API and where the documentation lives. It would point to
api-docs.resomix.com. I need you to confirm which links we publish.

### 2. Link headers

The homepage response carries pointers to the API catalogue, the sitemap and llms.txt, so an agent
finds them without having to read the page first. This is one rule in a file we already have.

### 3. auth.md

A plain text file at `/auth.md` that explains how an agent acting for a person can register and
sign in. This is a policy question more than a technical one. My suggested version is honest and
conservative. It says where a person creates an account, that Google sign in is available, that
email verification needs the person, that API keys are issued through the guided pilot, and that
automated bulk sign ups are not permitted. The wording should be checked against the Terms.

## Level 3 and Commerce

None of this is for now. Most of it only applies to a site that runs its own AI agent or sells
products.

| Check | Does it apply to us |
|---|---|
| OAuth Discovery and OAuth Protected Resource | No. Our API uses partner keys, not OAuth |
| A2A Agent Card and Skills Index | No. Only for sites that run their own AI agent |
| Web Bot Auth and DNS-AID | No. Only for companies that send their own bots out |
| WebMCP | Not yet. Experimental, lets an agent use the search on a page |
| MCP Server Card | Not yet, but see the note below |
| Commerce, all five | No. We are not a shop, and Cloudflare does not score these |

One idea is worth keeping for later. An MCP server would let ChatGPT, Claude and others use
Resomix as a tool, for example to run a similarity search from inside a conversation. That is a
product project with real upside for visibility, not a checklist item, so it belongs in a separate
discussion.

## Plan and effort

| Step | Work |
|---|---|
| A | Content Signals line in robots.txt |
| B | API catalogue file |
| C | Link headers on the homepage |
| D | auth.md, once the wording is approved |
| E | Markdown for agents, built for the free plan |
| F | Rescan and verification |

Steps A to D and F complete Level 2 and take Level 1 to 4 of 5. Step E completes Level 1. Nothing here needs the paid Cloudflare plan, and nothing changes how the pages look.

## Decisions I need from you

1. Training, yes or no, in the Content Signals line. I recommend yes.
2. Which links we publish in the API catalogue. The docs site for certain. Anything else is up to
   you.
3. The policy for auth.md. May an agent register on behalf of a person, and under what conditions.
4. Whether to go ahead with the Markdown work in step E, since it is the largest item.

## One caution

The scan offers a "Set up in Cloudflare" button next to Content Signals. Please do not use it. It
switches on a feature that writes its own block at the top of our robots.txt and keeps rewriting
it from a dashboard setting. Writing the one line ourselves passes the same check and keeps
robots.txt fully under our control.

---

## As built, 18 September 2026

Four of the five outstanding items are done. Nothing here touches page copy, locale files, the
question blocks or any structured data, so the September content work is untouched by construction.
The full spec suite was re-run after each change and all of it passes.

### What was published

| File | What it is |
|---|---|
| `robots.txt` | One `Content-Signal` line added directly under `User-agent: *`. Exactly one directive added, every existing rule and the sitemap line untouched |
| `.well-known/api-catalog` | An RFC 9727 linkset naming the Resomix Partner API, with six documentation links, the plain-language description on `/developers`, the author, the Terms, and the pilot page as the route to access |
| `_headers` | Three `Link` relations on every response, and media types for the two extensionless files. Added to the existing block, never a rewrite of it |
| `auth.md` | Written from copy already on the site. The H1 must literally contain "auth.md", which the scanner checks and a descriptive title fails |

### The decision that needed making

`Content-Signal: search=yes, ai-input=yes, ai-train=yes`. All three yes, agreed 18 September. The
reasoning on the third is that training is how an assistant comes to know a brand without having to
search for it, which is the same outcome the rest of this work is chasing. It covers the marketing
text and nothing else. Uploaded audio is never used for training, and that statement on the Trust
page is unaffected.

### The rescan, and what it found

Run on 18 September after the deploy. Quick Wins went to **4 of 5** and Technical Groundwork to
**2 of 3**. Content Signals, the API catalogue and the Link headers all report green.

auth.md came back as "exists but is missing the expected Auth.md heading". The check is on the first
heading, which has to contain the string `auth.md`. It opened with a descriptive title instead, so
the file was correct and the heading was not. Now `# auth.md for Resomix`, and the spec asserts it.

The same rescan settled the shape of the rest of that file. The standard asks for OAuth discovery
documents where they exist, and falls back to a self-contained page where they do not. Resomix has
no authorization server, so the fallback is the branch we are on: name the audience, give the
endpoints, list the methods, explain how credentials are used. There is now a short OAuth section
saying plainly that nothing is published at `/.well-known/oauth-protected-resource` and why, so a
client stops looking instead of treating the absence as a fault.

### What auth.md deliberately says

That an agent **cannot** complete a sign-up on its own, because email verification goes to the
person's inbox and Google sign-in needs their consent. That there is no public sandbox and no
self-serve API key, so there is no endpoint an agent can call to provision itself a credential. And
that card details are the person's to enter, never an agent's.

It also states that **sharing or transferring account credentials is not permitted**, and that an
agent should therefore not ask a person for their Resomix password or store one. That is not a
stylistic choice. It is already a Terms clause, quoted on the pricing page, and a document inviting
an agent to sign in with someone's password would have contradicted it on the same domain. The sign
in endpoint is documented, because the standard asks for it and a person following the link is the
intended flow. What is not documented is a way to hand that password to software.

Being useful to an agent and being honest with it turn out to be the same thing here. The honest
answer to "how does a bot register on behalf of a user" is that it cannot, and here is the partner
API, which is the route that exists for automation.

### The API catalogue has no `service-desc`, on purpose

The catalogue links to documentation, not to a machine-readable specification, because there is not
yet one we trust. The `openapi.json` in the developer hub repository lists different endpoint paths
from the reference the hub renders. Publishing a spec with the wrong paths is worse than publishing
none. Once the API team says which is current, adding a `service-desc` link is a few minutes and it
is the single most useful thing in this file.

### Guards

`apps/landing/src/test/agentReadiness.spec.ts`, eleven assertions against the built output. These
files have no visible consumer, so nothing on a page breaks when one goes missing, which is exactly
why they need a test.

It checks the Content-Signal line and its position, that robots.txt still allows crawling and still
names the sitemap, that the catalogue is valid JSON in the linkset shape and names an API with
documentation, that auth.md still makes its three honest claims, that both extensionless files
declare a media type, that the three Link relations are present, that everything the Link header
promises is actually published, and that every address in both files is an https Resomix host.

It also asserts that HSTS, the report-only CSP and the immutable asset caching rule are still in
`_headers`. Cloudflare's Bot Preference Sync would rewrite robots.txt from a dashboard setting and
drop everything below its own block, and that is the failure this suite is watching for.

### Still to do

1. **Deploy, then rescan.** The Cloudflare scan reads the live site, so the four items above report
   green only after a release.
2. **Markdown for agents**, the one remaining item, deliberately held back. It is the only item that
   introduces a Cloudflare Pages Function, and `functions/_middleware.ts` runs in front of every
   request on the project, static assets included. If it throws, the whole site does, and that now
   includes the pages Google and Bing began crawling on 18 September. It will be done on its own,
   after the four above are verified green, with strict content negotiation so it only acts on a
   request that explicitly asks for Markdown and otherwise falls straight through, a catch that
   falls through on any error, and no involvement with `/assets`, `/scripts`, `/fonts` or `/auth`.
   The Cloudflare Pages root-directory setting for this monorepo needs checking first, so the
   `functions/` directory lands where Pages expects it.

---

## The auth.md check, and why I am recommending we stop at 2 of 3

Second rescan, 18 September 2026. The heading complaint is gone. The new one is

> auth.md exists but OAuth Protected Resource Metadata was not found

That is a different request, and it is the one item on this whole list I do not think we should
satisfy.

### What it is asking for

Its own instructions spell it out. Publish OAuth Protected Resource Metadata at
`/.well-known/oauth-protected-resource` containing `resource`, **`authorization_servers`**,
`scopes_supported` and `bearer_methods_supported`. Then publish OAuth Authorization Server metadata
at each advertised authorization server's `/.well-known/oauth-authorization-server`, with an
`issuer` that matches.

In other words, advertise an OAuth authorization server, and then describe it.

### Why we cannot honestly do that

**Resomix has no authorization server.** The partner API authenticates with `rmx_` keys issued to
approved partners during onboarding, sent either as `X-Api-Key` or as a bearer token. There is no
authorization endpoint, no token endpoint, no client registration, and no flow for a third party to
obtain a credential. I checked the backend rather than assuming: the only matches for "token
endpoint" are an Apple developer token and the playlist embed token, neither of which is OAuth.

So publishing that metadata means naming an authorization server that does not exist. An agent that
read it and followed the issuer would send an authorization request into a 404. That is worse than a
missing badge, because it fails at the moment someone is actually trying to integrate, and it fails
silently until then.

### The half measure, and why it still does not fit

`authorization_servers` is optional in RFC 9728, so a truthful minimal document is possible. It
would state the resource, that bearer tokens go in the header, the documented scope, and where the
documentation is. Every line true.

Two things are still wrong with it. The check wants `authorization_servers`, so it would most likely
stay red anyway. And the metadata belongs at the resource's own origin, `api.resomix.com`, not on
the marketing site, so serving it from here would put it in the wrong place to make a scanner happy.

### What this check is actually for

It is Level 2, "Help AI bots use your services by registering on behalf of users". It is aimed at a
service an agent can sign up for and start transacting with on its own. The Resomix partner API is
the opposite by design. Access follows a scoping conversation and a signed agreement, and the site
says so in several places.

It also does nothing for the reason this work exists. Vladimir's report measures whether assistants
name Resomix when someone asks for a music similarity tool. An OAuth discovery document does not
move that number by any amount.

### Recommendation

Leave Quick Wins at 4 of 5 and Technical Groundwork at 2 of 3, and treat this one as answered rather
than failed. `auth.md` does the job the check is named for. It tells an agent exactly how a person
registers, that it cannot do that itself and why, that credential sharing is not permitted, and
where the supported route for automation actually is.

If Resomix ever wants agents to obtain credentials autonomously, OAuth is the right answer and it is
a backend project with a real design behind it, not a file. That is George's call and it belongs on
the API roadmap, not on this checklist.

---

## Markdown for agents, the last item

Built 18 September 2026. Cloudflare sells this as a switch that needs the Pro plan, so it is built
here instead. Their requirement is simply that a request asking for Markdown gets Markdown while
browsers keep getting HTML.

### How it is built, and why that shape

Two pieces, and the split is the whole design.

**The files are written at build time.** A new step, `tooling/markdownForAgents.ts`, converts each
prerendered page into a Markdown twin at `<route>.md`. Twenty routes, 110 KiB. It runs after the
body prerender and converts the HTML that pass has just written, so the Markdown is a conversion of
the exact bytes a browser receives rather than a second rendering of the same data down a different
path. It cannot drift from the page.

**The function only rewrites a path.** `apps/landing/functions/_middleware.ts` answers an
`Accept: text/markdown` request by fetching the twin that already exists. It generates nothing.

That matters because on Cloudflare Pages `_middleware` runs in front of **every** request to the
project, static assets included, and a throw there takes the site down. This one does as little as
it possibly can. Every branch that is not "this request explicitly asked for Markdown and a twin
exists" returns the untouched original response, and the whole body is wrapped in a catch that also
returns the untouched original. A bug in it costs the Markdown feature, not the website. To switch
it off, delete the file and redeploy; nothing else depends on it.

### What ends up in the twin

The conversion starts at `<main>`, so the header, the four navigation blocks, the beta banner and
the footer are all left out. That chrome is what assistants strip anyway, and repeating it on every
page is part of what made the pages expensive to read.

Inside that, only text wrapped in a content element is taken, meaning headings, paragraphs, lists
and the question blocks. This rule is doing real work. These pages carry visual schematics built
from plain divs, mock playlists with invented track names and percentages, and the same panels again
in a mobile variant. All of it is genuine text in the DOM and none of it is prose. An early version
without this rule produced a page that opened with "Night Circuit · Vela Nine" and "91%".

### Three faults found while building it, worth recording

**The step ran before the pages existed.** `closeBundle` is a parallel Rollup hook, so putting the
plugin after the prerender in the array did nothing. The first run reported twenty skipped routes
and a green build, which is the worst kind of wrong. The hook is now declared with `sequential` and
`order: 'post'`.

**React comment separators.** React writes `<!-- -->` between adjacent text expressions, and the
first converter carried them through as literal text. Comments are now stripped before parsing.

**Elements with no whitespace between them.** `<span>Choose a reference track</span><span>Search for
a track</span>` is separated by CSS, not by whitespace, so concatenating gave a run-on. A single
space now goes in where both sides end and start with a word character.

### Discovery

Three routes to the same content, so a client finds it whichever way it looks.

- `Accept: text/markdown` on the page's own address, handled by the function.
- `<route>.md`, which is a plain static file and works with no function at all.
- A `<link rel="alternate" type="text/markdown">` in every page's head, and a section in `llms.txt`
  explaining both.

The twins are served `noindex`. They are a second representation of a page that already has a
canonical address, and two indexable copies of the same words is exactly the duplication the rest of
this work exists to avoid.

### The one thing to check after deploying

Whether Cloudflare picks the function up at all. It sits at `apps/landing/functions/`, which is
correct if the Pages project's root directory is `apps/landing`. If the root directory is the
repository root instead, Pages will look for `functions/` there and silently ignore this one.

That failure mode is harmless and easy to read. The `.md` addresses keep working either way, and
every page keeps advertising its twin; only the `Accept` header negotiation would be inactive. The
check is one command, and it should print `text/markdown`:

```
curl -s -o /dev/null -D - -H "Accept: text/markdown" https://resomix.com/product/sonic-discovery | grep -i content-type
```

If it prints `text/html`, the function was not picked up, and the fix is the Pages root directory
setting rather than anything in this repository. A repository-root `functions/` directory would be
the wrong answer, because the other Pages projects in this monorepo build from that same root and
would inherit it.


---

## Markdown negotiation: the function was not picked up, and the better fix

Deployed and rescanned 18 September 2026.

### What shipped and works

All twenty Markdown twins are live. Verified on production:

- `https://resomix.com/index.md`, `/product/sonic-discovery.md` and the rest all return **200** with
  `content-type: text/markdown; charset=utf-8`
- each carries `x-robots-tag: noindex`, so they never compete with the page they mirror
- every HTML page advertises its twin with `<link rel="alternate" type="text/markdown">`
- `llms.txt` explains both routes to them

So an agent can read clean Markdown of any page today. The substance of this item is done.

### What did not work

`Accept: text/markdown` still returns `text/html`. A cache purge changed nothing, which rules out
caching and confirms the function is simply not running.

The cause is where Pages looks for functions. It looks in the project's **root directory**, and this
project builds from the repository root, because its build command is the root-level
`pnpm build:landing` script. So Pages looks for `<repo root>/functions/` and never sees
`apps/landing/functions/_middleware.ts`.

**Moving it to the repository root would work and is the wrong fix.** The webapp, admin and embed
Pages projects build from that same root. All three would inherit this middleware and turn from
plain static-asset projects into Functions projects, with the cold starts and the failure surface
that implies, to satisfy one checklist item on a fourth project.

### The recommended fix, a URL Rewrite transform rule

No code, no functions, nothing inherited by the other projects, and available on the Free plan.
Cloudflare dashboard, resomix.com, **Rules**, **Transform Rules**, **Rewrite URL**, Create rule.

**Use "Edit expression", not the visual builder.** This is the step that went wrong on the first
attempt and it is easy to miss. The form opens on a Field, Operator and Value builder, and pasting
an expression into the Value box makes Cloudflare treat the whole expression as a string to match
the URL against. The preview then reads
`(http.request.full_uri wildcard r#"http.request.uri.path in {...}"#)` and the rule matches nothing,
because it is literally asking whether the URL looks like the text of an expression. The
"This rule may not apply to your traffic" warning about DNS is a symptom of the same mistake, not a
separate problem.

The link is at the top right of the Expression Preview box. Click it, clear the field, and paste the
raw expression.

Both expressions below also pin the hostname. That scopes the rule to the site it is meant for and
satisfies the check that produced the DNS warning, since resomix.com is a proxied record.

Two rules, because the home page needs a different target from the rest.

**Rule 1, "Markdown for agents, home page"**

Custom filter expression:

```
http.host eq "resomix.com" and http.request.uri.path eq "/" and http.request.headers["accept"][0] contains "text/markdown"
```

Then: Rewrite to, **Path**, **Static**, value `/index.md`. Leave the query alone.

**Rule 2, "Markdown for agents, all other pages"**

Custom filter expression:

```
http.host eq "resomix.com" and http.request.uri.path in {"/about" "/product" "/product/sonic-discovery" "/product/track-intelligence" "/product/catalog-intelligence" "/developers" "/partners" "/partners/pilot" "/trust" "/solutions/record-labels" "/solutions/music-publishers" "/solutions/sync-agencies" "/solutions/music-libraries-sample-providers" "/solutions/djs" "/solutions/music-curators" "/solutions/producers" "/pricing" "/contact" "/waitlist"} and http.request.headers["accept"][0] contains "text/markdown"
```

Then: Rewrite to, **Path**, **Dynamic**, value:

```
concat(http.request.uri.path, ".md")
```

The path list is exact rather than a pattern on purpose. A pattern such as "any path without a file
extension" would also catch `/robots.txt` and `/sitemap.xml` and rewrite them into 404s for any
client that happened to send that Accept header. An explicit set cannot misfire. The cost is that
adding a route means adding it here, which is noted beside the route list in
`apps/landing/src/routes/seoConfig.ts`.

### Verifying

Should print `text/markdown`:

```
curl -s -o /dev/null -D - -H "Accept: text/markdown" https://resomix.com/ | grep -i content-type
```

And a browser must be unaffected, so this must still print `text/html`:

```
curl -s -o /dev/null -D - -H "Accept: text/html,application/xhtml+xml" https://resomix.com/ | grep -i content-type
```

### The other route, if you would rather

Set this Pages project's **root directory** to `apps/landing` and adjust the build command and
output directory to match. The function then activates exactly as written, with no rules to
maintain and no route list to keep in step. It is the tidier answer and the riskier change, because
a pnpm workspace build from a subdirectory needs the build command reworked, and getting that wrong
takes the site down rather than degrading it.

I would take the transform rule. Two rules in a dashboard, reversible in seconds, and the blast
radius is one hostname.

---

## Markdown negotiation, working and verified

18 September 2026. Two URL Rewrite rules, both active, verified against production.

| Client sends | Gets back |
|---|---|
| `Accept: text/markdown` on any of the 20 pages | `200 text/markdown; charset=utf-8` |
| A normal browser `Accept` on any page | `200 text/html; charset=utf-8` |

Checked on `/`, `/product/sonic-discovery`, `/developers`, `/solutions/djs`, `/pricing` and
`/waitlist`, both ways round.

### It cannot misfire

The explicit path set was the right call. Every one of these was requested with
`Accept: text/markdown` and every one came back untouched.

| Path | Still returns |
|---|---|
| `/robots.txt` | `text/plain` |
| `/sitemap.xml` | `application/xml` |
| `/llms.txt` | `text/plain` |
| `/auth.md` | `text/markdown`, its own file, not a rewrite |
| `/.well-known/api-catalog` | `application/linkset+json` |
| `/og-cover.png` | `image/png` |

A pattern rule such as "any path with no file extension" would have rewritten the first three into
404s for any client that happened to send that header.

The rewrite also stays out of the HTML path entirely. The canonical on `/developers` is still
`https://resomix.com/developers`, not the Markdown address, so nothing about how search engines see
the site changed.

### Where this leaves the two levels

Quick Wins 5 of 5. Technical Groundwork 2 of 3, with the third being the OAuth item that we are
deliberately not faking, for the reasons set out above.

### What to keep in step

Adding a route means adding its path to rule 2, or that page will answer with HTML while every
other page answers with Markdown. There is a note beside the route list in
`apps/landing/src/routes/seoConfig.ts` saying so. The rule lives in the Cloudflare dashboard under
Rules, Transform Rules, Rewrite URL, named "Every other page".

---

## Replacing the path list with a wildcard

Asked on 18 September, and the right question. Maintaining a list of every page inside a dashboard
rule is a trap: it works until someone adds a page and nobody remembers.

My original objection was that a wildcard would catch `/robots.txt` and `/sitemap.xml` and rewrite
them into 404s. **That was wrong.** Both of those have file extensions, so a rule keyed on "no
extension" never touches them. I checked the whole build rather than reasoning about it again, and
there are exactly three paths with no extension:

| Path | Served? |
|---|---|
| `/_redirects` | No. Cloudflare Pages consumes it |
| `/_headers` | No. Cloudflare Pages consumes it |
| `/.well-known/api-catalog` | Yes. The one genuine collision |

One exclusion is all it takes.

### The replacement for rule 2

Same rule, same action, new expression. Paste it with **Edit expression**, not the builder.

```
http.host eq "resomix.com" and http.request.headers["accept"][0] contains "text/markdown" and http.request.uri.path.extension eq "" and not starts_with(http.request.uri.path, "/.well-known/") and not ends_with(http.request.uri.path, "/")
```

Action is unchanged: Rewrite to, Path, Dynamic, `concat(http.request.uri.path, ".md")`.

Rule 1, for the home page, stays exactly as it is.

### What each clause is for

| Clause | Why |
|---|---|
| `http.host eq "resomix.com"` | Scopes it to this site and satisfies the proxied-DNS check |
| `accept contains "text/markdown"` | The only thing that should trigger any of this |
| `path.extension eq ""` | A page has no extension. This is what keeps `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/auth.md` and every image and asset out |
| `not starts_with(..., "/.well-known/")` | The one extensionless file we actually serve |
| `not ends_with(..., "/")` | Excludes `/` (rule 1 handles it) and the slashed form of any page. `/about/` falls through, Pages redirects it to `/about`, and the client gets Markdown on the retry |

Any page added from now on is covered with no further work.

### If the editor rejects `http.request.uri.path.extension`

That field is relatively recent. If the expression will not validate, use this instead, which relies
only on `ends_with` and `starts_with`:

```
http.host eq "resomix.com" and http.request.headers["accept"][0] contains "text/markdown" and not ends_with(http.request.uri.path, "/") and not starts_with(http.request.uri.path, "/.well-known/") and not starts_with(http.request.uri.path, "/assets/") and not starts_with(http.request.uri.path, "/fonts/") and not starts_with(http.request.uri.path, "/scripts/") and not ends_with(http.request.uri.path, ".txt") and not ends_with(http.request.uri.path, ".xml") and not ends_with(http.request.uri.path, ".md") and not ends_with(http.request.uri.path, ".png") and not ends_with(http.request.uri.path, ".svg") and not ends_with(http.request.uri.path, ".ico") and not ends_with(http.request.uri.path, ".json") and not ends_with(http.request.uri.path, ".webp") and not ends_with(http.request.uri.path, ".html")
```

Longer, same effect, no new fields.

### The one thing the wildcard gives up

A mistyped address from a client that asks for Markdown, say `/produkt`, now becomes a request for
`/produkt.md`, which does not exist. Cloudflare Pages answers with the 404 page. Without the
wildcard it would have answered with the 404 page too, just labelled `text/html` instead of
`text/markdown`. A 404 either way, and not worth maintaining a list of twenty paths to avoid.

### After switching

Re-run both checks. The first must say `text/markdown`, the second must say `text/html`.

```
curl -s -o /dev/null -D - -H "Accept: text/markdown" https://resomix.com/solutions/djs | grep -i content-type
curl -s -o /dev/null -D - -H "Accept: text/html,application/xhtml+xml" https://resomix.com/solutions/djs | grep -i content-type
```

And confirm the exclusion holds, which must still say `application/linkset+json`:

```
curl -s -o /dev/null -D - -H "Accept: text/markdown" https://resomix.com/.well-known/api-catalog | grep -i content-type
```

Once it is in, the note in `apps/landing/src/routes/seoConfig.ts` about keeping the rule in step can
go, and so can this maintenance burden.

---

## Closed, 18 September 2026

The wildcard rule is deployed and the maintenance burden is gone. Verified against production.

| Check | Result |
|---|---|
| All 20 pages with `Accept: text/markdown` | `text/markdown` on every one |
| The same 20 with a browser `Accept` | `text/html` on every one |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt`, the IndexNow key file | untouched, still `text/plain` |
| `/sitemap.xml` | untouched, `application/xml` |
| `/.well-known/api-catalog` | untouched, `application/linkset+json` |
| `/og-cover.png` | untouched, `image/png` |
| `/auth.md` | its own file, `text/markdown`, not a rewrite |
| `/about/` with a Markdown Accept | `308` to `/about`, which then answers in Markdown |

A page added from now on is covered with no change in Cloudflare and no change here.

### Final state

| Group | Start | Now |
|---|---|---|
| Quick Wins, Level 1 | 3 of 5 | **5 of 5** |
| Technical Groundwork, Level 2 | 0 of 3 | **2 of 3** |

The remaining item is the OAuth one, deliberately not done. The reasoning is in this document and
the plain-language version is in `AGENT_READINESS_STATUS_FOR_GEORGE.md`.

### Where the pieces live

| Piece | Where |
|---|---|
| Content Signals, robots.txt | `apps/landing/public/robots.txt` |
| API catalogue | `apps/landing/public/.well-known/api-catalog` |
| Link headers, media types, the `noindex` on twins | `apps/landing/public/_headers` |
| auth.md | `apps/landing/public/auth.md` |
| Markdown twin generation | `tooling/markdownForAgents.ts`, wired in `apps/landing/vite.config.ssr.ts` |
| Serving the twins on `Accept` | Cloudflare, Rules, Transform Rules, Rewrite URL, two rules |
| Guards | `apps/landing/src/test/agentReadiness.spec.ts`, 18 assertions |
| The unused Pages function | `apps/landing/functions/_middleware.ts`, inactive, safe to delete |
