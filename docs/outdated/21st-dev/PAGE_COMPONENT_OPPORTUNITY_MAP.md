# Page–Component Opportunity Map (14 Phase 1 pages)

Status: Draft — awaiting approval (Gate 2/4)
Repository snapshot: `george-updates` at `2e00707`
Last reviewed: 2026-07-22

Legend — **Custom**: Resomix-native only, never sourced externally. **Existing**: current `@resomix/ui`/landing components expected to cover it. **Research**: 21st.dev interaction-pattern research may help (category 4). **Prohibited**: explicitly banned external sourcing. **Maturity**: expected end-stage of any adapted component.

| Page | Custom Resomix visuals | Existing components | Possible 21st research | Prohibited external | Expected maturity |
|---|---|---|---|---|---|
| Product Overview `/product` | Hero, platform map, similarity visual, analysis fragment, catalogue schematic, Void Field | Buttons, LinkButton, pills, dotted panels | Mega-menu mechanics*, responsive tabs/disclosure, CTA split, proof-panel disclosure | Hero identity, diagrams, background | Stage 1→2 (tabs/accordion may reach 2) |
| Sonic Discovery | Track rows, waveforms, scores, chain map | Track-row pattern, buttons | Result-list interaction, comparison tabs, expandable workflow, mobile overflow | Waveform/score visuals | Stage 1 |
| Track Intelligence | Energy/key/structure/timbre/mood visuals, PYXIS-1 fragments | Dotted panels, tags | Tabs, accordions, technical table layout, dashboard navigation | Analysis visuals, sample-data presentation | Stage 1→2 (tabs shared with Developers) |
| Catalogue Intelligence | Catalogue map, cluster schematic, rights/truth visuals | Panels, protocol lists | Enterprise process timeline, pilot-step disclosure, comparison table, FAQ | Schematic, cluster visuals | Stage 1 |
| Developers `/developers` | API architecture, processing diagram, real sandbox content | CodeTyping pattern, panels | Code block + copy action, request/response tabs, docs sidebar, endpoint table, integration steps | Sandbox content, API diagrams | Stage 1→2 (code block likely reused) |
| DJs | Audience-specific evidence, motifs | Buttons, rows | Workflow steps, use-case disclosure, FAQ, CTA pattern | All product visuals | Stage 1 |
| Producers | Same as DJs (analysis-flavoured) | Same | Same as DJs | Same | Stage 1 (reuse DJs adaptations) |
| Curators & Music Supervisors | Workflow evidence, share visuals | Same | Same as DJs | Same | Stage 1 (reuse) |
| Labels & Distributors | Activation cluster, pilot visuals | Panels | Process timeline, comparison, FAQ | Cluster/pilot visuals, claims | Stage 1 |
| Platforms & Music Technology | Embed schematic, engine evidence | Panels, code styles | Comparison table, feature matrix, tabs | Schematics, claims | Stage 1 |
| Partner Overview `/partners` | Three-path junction, sandbox section | Existing form components, carousel content | Process timeline, form structure refinements | Partner architecture, form claims | Stage 1 |
| Private Catalogue Pilot | Protocol visual (calm) | FormInput/FormError set | Pilot form layout, accessible field grouping, success/failure states | Pilot terms, containment language | Stage 1 |
| Integrations | Model matrix (dotted table) | Panels, tables | Comparison matrix mechanics, disclosure | Model claims | Stage 1 |
| Trust `/trust` | Deliberately minimal; legal-library links | Dotted separators, links | Legal/support navigation, technical accordion (restrained) | Everything visual; trust language | Stage 1 |

\* Mega-menu is nav-redesign scope (separate approved task, cross-app shared `Navbar`) — research may inform it, but implementation follows IMPLEMENTATION_RULES §8 consumer-audit rules, not the normal page flow.

Cross-page duplicates (tabs, accordion, code block, timeline) must converge on **one** adaptation each (ADOPTION_POLICY §7) — first page implements Stage 1; second consumer triggers the Stage 2 review, not a re-import.

## Change history

- 2026-07-22 — Initial map. Author: Claude.
