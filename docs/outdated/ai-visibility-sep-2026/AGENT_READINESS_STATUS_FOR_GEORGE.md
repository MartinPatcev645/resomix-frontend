# Making resomix.com readable by AI agents: what is done

Prepared for George, 18 September 2026.

This is the status of the work you approved from the agent readiness findings. Everything below is
live on resomix.com. Nothing on this list changes how a single page looks.

## The short version

Cloudflare grades how ready a website is for AI agents, in two levels that matter to us.

| | Where we started | Where we are now |
|---|---|---|
| Level 1, the basics | 3 of 5 | **5 of 5** |
| Level 2, the technical groundwork | 0 of 3 | **2 of 3** |

The one item left at Level 2 is the one I am recommending we do not do, and the reason is at the
bottom of this page.

## Item by item

| What you approved | Status |
|---|---|
| Content Signals, a line telling automated systems how they may use our text | **Done.** All three permissions set to yes, including training, as agreed |
| Markdown for agents, serving a clean text version of each page | **Done.** All 20 pages, and it turned out better than planned, see below |
| API catalogue, a small file telling an agent we have an API and where its documentation is | **Done** |
| Link headers, pointers carried in every response so an agent finds those files without reading a page | **Done** |
| auth.md, a page explaining how sign-up and API access work | **Done** |
| Re-run the Cloudflare scan and confirm | **Done.** Level 1 now reads 5 of 5 |

## The Markdown one is worth two minutes of your time

This is the item with the most value in it, and it is easiest to understand by looking at it.

An AI assistant reading one of our pages has to wade through the menu, the cookie banner, the
footer and a great deal of invisible code to find the four paragraphs that actually say something.
Cloudflare sells a fix for this, but only on a paid plan we are not taking, so we built our own.

Every page now has a clean text version alongside it. Same words, no menu, no footer, no code. When
an assistant asks for the readable version it gets that instead, and a normal visitor still gets the
normal page. Nothing changed on screen.

You can see exactly what an assistant now receives. Add `.md` to the end of any page address:

- https://resomix.com/product/sonic-discovery.md
- https://resomix.com/developers.md
- https://resomix.com/index.md

Some browsers download those rather than display them, so I have also put together a side-by-side
view that shows the page and what the assistant reads, which is easier to look at.

## A useful side effect

Building this turned up two faults that nothing else had caught, both now fixed.

The cookie banner was using a top-level heading for its title, which meant **every page on the site
and in the app had two main headings** instead of one. Search engines read the first heading as what
a page is about, and ours was saying "Customize your cookie preferences". It was invisible in any
normal review because the banner is added by a script after the page loads.

The banner and the preferences window also had no label telling screen-reader software what they
are. Both now do.

## The one item I am recommending we skip

Level 2 has a third item that wants us to publish OAuth login documents, so an agent could register
for an account and get API access on its own.

**We cannot do that honestly.** Our partner API does not work that way. Keys are issued to approved
partners after a conversation, there is no public sandbox, and there is no automated way to get one.
The check specifically wants us to advertise a login server, and we do not have one. Publishing that
file would mean pointing partners' software at an address that does not exist, which fails at the
exact moment someone is genuinely trying to integrate with us.

The page it is asking for, auth.md, is published and does its job. It tells an agent plainly how a
person registers, that it cannot do that itself and why, and where real API access comes from.

If we ever want agents to get credentials on their own, that is a proper piece of backend work with
a design behind it, not a file. It belongs on the API roadmap rather than on this checklist.

## What this does and does not do

Worth being straight about. This work makes us easy and cheap for an AI agent to read, and it
removes every technical excuse one could have for skipping us.

It is not the same thing as the work from Vladimir's report, which was about making our pages
actually say who we are. That is the one that should move the numbers, and we will see it when he
re-runs his test in early October.

## Nothing here is one-way

Every item is a small file or a setting. Any of them can be removed in minutes with no effect on the
site. The two rules that serve the readable text live in Cloudflare and can be switched off from the
dashboard.
