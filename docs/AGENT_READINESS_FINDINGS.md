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
