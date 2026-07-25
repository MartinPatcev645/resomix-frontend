# 21st.dev in the Resomix Workflow

Status: Draft — awaiting approval (Gates 1–4)
Repository: `/Users/astor/Documents/resomix-web`
Repository snapshot: `george-updates` at `2e00707`
Authority: Governance for using 21st.dev as a component-pattern source. Subordinate to the Resomix governing documentation (below). **No production change has been made; nothing is installed.**
Primary sources: live official 21st.dev pages verified 2026-07-22 (`21st.dev`, `/pricing`, `/mcp`, `github.com/21st-dev`)
Last reviewed: 2026-07-22

## What 21st.dev is here

A community registry of 10,000+ React/Tailwind components and templates (verified live): searchable semantically, previewable, each with an author and an AI-ready "copy prompt" workflow for Claude Code/Cursor, plus shadcn-registry-format install and an official CLI/MCP ("21st MCP", formerly Magic MCP). In this project it is a **selective component-discovery and implementation accelerator** for *interaction mechanics only* — disclosure, tabs, accordions, form structure, code-block controls, comparison layouts.

## What it is not

Not the Resomix design system; not a source of page identity, brand, colours, typography, backgrounds (Resomix Void Field is custom), product diagrams, schematics, copy, claims, routes, or navigation IA; not a one-click production installer; not permission to add dependencies or introduce shadcn/ui across the project.

> 21st.dev may supply a useful interaction pattern or structural primitive. Resomix supplies the visual identity, content, product truth, tokens, architecture, and final implementation.

## Who approves

**The user approves everything**: whether to consult 21st.dev per section, which candidate is chosen, any dependency, whether the adapted result looks like Resomix, whether implementation proceeds, and any promotion into `packages/ui`. No component enters production without user approval.

## Division of responsibilities

**Claude Code** = architect/curator (reuse audit → search brief → shortlist ≤3 → evaluation → adaptation spec) · **21st.dev** = pattern source (mechanics, not identity) · **Cursor** = surgical implementer of one approved adaptation contract at a time · **Reviewer** (Claude or separate pass) = drift/dependency/a11y/performance/licence gate. Details: `ORCHESTRATION.md`.

## Governing documents (outrank any 21st.dev component)

`docs/BRAND_GUIDELINES.pdf` · `docs/DESIGN_SYSTEM.md` · `docs/WEBSITE_ARCHITECTURE.md` · `docs/IMPLEMENTATION_RULES.md` · `docs/PAGE_BRIEFS.md` · `docs/design-lab/{RESOMIX_VISUAL_DNA, VISUAL_UPGRADE_SYSTEM, APPROVED_VISUAL_MOTIFS, PREMIUM_VISUAL_CRAFT_STANDARD, DIRECTION_RECOMMENDATION}.md` · `docs/design-lab/void-field-study/` (background system).

## Files in this directory

| File | Purpose |
|---|---|
| `ORCHESTRATION.md` | End-to-end sequence with stop conditions |
| `COMPONENT_ADOPTION_POLICY.md` | Reuse-first, selection, dependency, licence, maturity, promotion, rollback rules |
| `MCP_CLI_SETUP.md` | Verified official setup + security policy (nothing installed yet) |
| `SEARCH_PLAYBOOK.md` | How to search, limit, inspect, and record |
| `SOURCE_REGISTER.md` | Permanent source/licence register (empty; examples marked) |
| `PAGE_COMPONENT_OPPORTUNITY_MAP.md` | Per-page: custom vs existing vs research vs prohibited |
| `PRODUCT_OVERVIEW_SCOUTING_PLAN.md` | Initial six-need scouting plan |
| `templates/` | Search brief, evaluation, adaptation spec, Cursor task templates |

## Approval sequence

Gate 1 role → Gate 2 adoption policy → Gate 3 MCP/CLI setup → Gate 4 Product Overview scouting scope → Gate 5 per-candidate approval → Gate 6 surgical Cursor task. This task stops after presenting Gates 1–4.

## Change history

- 2026-07-22 — Initial governance set. Author: Claude.
