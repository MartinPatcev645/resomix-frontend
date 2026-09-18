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
| Content Signals | Add one line under `User-agent: *` stating how automated systems may use the content | `apps/landing/public/robots.txt` | 10 min |
| Markdown for agents | Serve a plain-text version of each page when an agent asks for one. Cloudflare's own switch needs the Pro plan, so we build it. A build step writes a Markdown copy of every page, and a small Cloudflare Pages function returns it when the request asks for Markdown | new `apps/landing/functions/_middleware.ts` plus a new build step beside `tooling/prerenderBodies.ts` | 1 to 2 h |
| API catalogue | Publish a small file listing our API and where its documentation lives, following the published standard, and serve it with the right content type | new `apps/landing/public/.well-known/api-catalog` plus one rule in `apps/landing/public/_headers` | 30 to 40 min |
| Link headers | Add one response header pointing at the API catalogue, the sitemap and llms.txt, so an agent finds them without reading the page | `apps/landing/public/_headers` | 10 min |
| auth.md | Publish a short page explaining how an agent acting for a person signs up and signs in, and how API access is granted | new `apps/landing/public/auth.md` | 30 min, after the wording is agreed |
| Rescan and verify | Re-run the Cloudflare scan and check each item reports green | Cloudflare, AI Crawl Control, Optimization | 10 min |

**Total 2.5 to 3.5 hours**, which takes Level 1 to 5 of 5 and Level 2 to 3 of 3. Without the
Markdown item it is about 1.5 hours, and the score becomes Level 1 at 4 of 5 with Level 2 complete.

These are clean-run times. If any item does not report green on the first rescan, add a little for
troubleshooting, most likely on the Markdown item, since it is the only one that introduces new
moving parts.

Three of these need a decision from you before they can be written, and they are listed at the end
of this document. The Content Signals line needs your answer on training, the API catalogue needs
to know which links we publish, and auth.md needs the sign-up policy.

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
