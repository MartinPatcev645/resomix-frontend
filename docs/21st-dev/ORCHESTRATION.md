# Orchestration — User · Claude Code · 21st.dev · Cursor · Reviewer

Status: Draft — awaiting approval (Gate 1)
Repository snapshot: `george-updates` at `2e00707`
Last reviewed: 2026-07-22

## The sequence (with stop conditions)

```text
 1. Page brief (docs/PAGE_BRIEFS.md)            — defines the section and its truth labels
 2. Repository reuse audit                       — Claude inspects packages/ui, landing components,
                                                   sections, hooks (mandatory; see ADOPTION_POLICY §1)
        ⛔ STOP if an existing component solves the need → no external research
 3. Component need classification (1–4)          — only category 4 ("external interaction-pattern
                                                   research may help") continues
        ⛔ STOP: user confirms research is wanted for this section
 4. 21st search brief                            — templates/COMPONENT_SEARCH_BRIEF.md, ≤3 candidates
 5. Candidate shortlist + evaluation             — templates/COMPONENT_EVALUATION.md, one recommended
        ⛔ STOP: user approves ONE candidate (or rejects all → custom Resomix build)
 6. Adaptation specification                     — templates/COMPONENT_ADAPTATION_SPEC.md
        ⛔ STOP: user approves the spec (incl. any dependency — default: none)
 7. Surgical Cursor task                         — templates/CURSOR_COMPONENT_TASK.md; one section,
                                                   exact file scope, exact contract
 8. Implementation (Cursor)                      — smallest safe diff; Resomix tokens/components only
 9. Build + visual QA                            — IMPLEMENTATION_RULES §32 suite; mobile/desktop/
                                                   themes/keyboard/reduced-motion
        ⛔ STOP if validation fails → fix or roll back; never merge red
10. Source register update                       — SOURCE_REGISTER.md row (mandatory, even after
                                                   heavy adaptation)
11. Maturity review                              — Stage 1 by default; promotion only per
                                                   ADOPTION_POLICY maturity model
```

## Role contracts

- **User** — decides page, section, whether 21st is consulted, candidate, dependencies, visual acceptance, implementation go, promotion. Nothing proceeds past a ⛔ without the user.
- **Claude Code** — inspects the real repository first; writes briefs/evaluations/specs; never installs blindly; never lets the source dictate Resomix styling; prepares (but does not run) the Cursor task until Gate 6.
- **21st.dev** — supplies mechanics (layout, state, a11y, interaction, responsive approaches). Never supplies identity, tokens, copy, backgrounds, diagrams, routes, placement.
- **Cursor** — receives one adaptation contract; inspects target files; rebuilds inside existing conventions with Resomix tokens and shared components; removes framework assumptions; updates barrels/routes/translations/layout modes where the contract says; runs validation; produces a reviewable diff. Never receives "install this and make it fit".
- **Reviewer** — compares approved spec ↔ source pattern ↔ Cursor diff ↔ responsive result ↔ build result; hunts visual drift, generic SaaS styling, duplicate components, unwanted dependencies, Next.js remnants, raw Tailwind measurements, a11y/perf regressions, mobile divergence, and licence/source-record omissions.

## Cadence rules

One component need at a time · one candidate approved per section · one Cursor task per adaptation · register updated in the same cycle · no parallel unreviewed adaptations.

## Change history

- 2026-07-22 — Initial orchestration. Author: Claude.
