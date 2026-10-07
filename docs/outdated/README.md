# Outdated documentation

Nothing here is maintained, and nothing here should be trusted as a description of how the
frontend works today. It is kept because it records **why** decisions were made, and because
some of it is the only written account of a piece of work.

Archived 7 October 2026. Everything outside this folder was checked against the code on the
same day.

**If a document here disagrees with the code, the code is right.**

---

## Read this if you are looking for the design system

`design-proposal-jul-2026/DESIGN_SYSTEM.md` was being cited by the onboarding document as
the source for "the tokens and visual language". **It is not, and following it would give
you the wrong values.**

Checked on 7 October 2026, it shares **zero token names** with the live system in
`packages/ui/src/design-system/styles.css`, and the colours it specifies, `#101010`,
`#242423`, `#50504F` and the rest, do not include the accent the site actually uses,
`#ee4a26`. It describes a design system that was proposed and never shipped.

The live source is `packages/ui/src/design-system/`, which has 37 tokens and its own README.
The onboarding pointer has been corrected.

---

## `design-proposal-jul-2026/` — a four-document proposal, partially implemented

Four linked documents from July 2026, all marked "Status: Draft proposal, awaiting approval
(revision 3)", all produced outside this team, and all cross-referencing each other.

| File | What it proposed |
|---|---|
| `WEBSITE_ARCHITECTURE.md` | Information architecture, routes, navigation and CTA strategy for the landing site |
| `PAGE_BRIEFS.md` | Content, structure, claims, CTAs and acceptance criteria for 14 pages |
| `DESIGN_SYSTEM.md` | Visual rules and tokens. See the warning above |
| `IMPLEMENTATION_RULES.md` | How the pages were to be built, derived from `instructions.md` |

**They were acted on in part and the site has since diverged.** The proposal lists 49
routes against 22 live today. Six live routes are not in it at all, which is the whole
`/solutions/*` audience set, the most commercially important pages on the site. Many
proposed routes never shipped, including `/company/careers`, `/developers/quickstart`,
`/api` and a landing-side `/analysis`.

They also reference a `docs/design-lab/` directory that does not exist in this repository.

So they are a record of a direction, useful for understanding why the landing site is
shaped the way it is, and not a description of it. `ROUTES.md` and
`apps/landing/src/routes/seoConfig.ts` are the authority on what exists.

---

## `ai-visibility-sep-2026/` — a shipped initiative

Seven documents from the September 2026 AI-visibility and agent-readiness work, which
shipped. 17 pages gained FAQ blocks with 85 questions, the developer hub was prerendered,
Bing was registered with IndexNow, and Markdown twins were served to AI crawlers.

| File | What it was |
|---|---|
| `AI_VISIBILITY_CONTENT_AUDIT.md` | The audit, 1,476 lines, the largest document in the repository |
| `AI_VISIBILITY_SUMMARY.md` | The summary of it |
| `AGENT_READINESS_FINDINGS.md` | What an AI agent could and could not do with the site |
| `AGENT_READINESS_STATUS_FOR_GEORGE.md` | The status report for the client |
| `BING_AND_INDEXNOW_STEPS.md` | The registration and submission steps, now done |
| `CONTENT_CHANGES_FOR_REVIEW.md` | Copy changes put up for approval |
| `GSC_FIX_PLAN_FOR_GEORGE.md` | The October Search Console plan, delivered |

The ongoing part of this work is the Search Console baseline, which is **not** archived and
is in [../reference/GSC_BASELINE_1_OCT_2026.md](../reference/GSC_BASELINE_1_OCT_2026.md).

---

## `21st-dev/` — a component-scouting exercise

22 files recording how three components were searched for and evaluated against a
third-party library. A mega menu, technical tabs and an API code block.

It holds a search playbook, an adoption policy, a source register, an orchestration
document, templates, and a search brief, evaluation and recommendation for each of the
three components.

It is a reasonable thing to have kept, and at 22 files it was also 30 percent of this
repository's documentation by file count while describing a one-off exercise on three
components. It references `docs/design-lab/` and `docs/BRAND_GUIDELINES.pdf`, only the
second of which exists.

---

## `rejected-trionn-direction/` — a visual direction that was not taken

Already archived before this pass, and correctly. Kept as the record of a direction that
was considered and rejected.

---

## `2025/` — superseded by what followed

| File | What it was |
|---|---|
| `howler_migration.md` | The plan to move to Howler. Done. The result is in [../reference/HOWLER_PEAKS_INTEGRATION.md](../reference/HOWLER_PEAKS_INTEGRATION.md) |
| `routes_missing.md` | Routes that did not exist yet. [../ROUTES.md](../ROUTES.md) is the current inventory |
| `FIXES_APPLIED.md` | A list of fixes applied in September 2025 |
| `IMPLEMENTATION_STEPS.md` | Implementation steps from the same period |

---

## Where to look instead

| You want | Read |
|---|---|
| The rules for writing code here | [`../../instructions.md`](../../instructions.md) |
| Getting set up | [../ONBOARDING.md](../ONBOARDING.md) |
| The design tokens | `packages/ui/src/design-system/` |
| What routes exist | [../ROUTES.md](../ROUTES.md) and `apps/landing/src/routes/seoConfig.ts` |
| How the system is put together | `official-documentation/systems/05-web-frontend.md` |
| Auth, SEO, structured data, waveforms | [../reference/](../reference/) |
