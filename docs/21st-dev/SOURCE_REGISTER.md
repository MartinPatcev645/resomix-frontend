# Source Register

Status: Active register — first real row added 2026-07-22 (PO-NAV-001). Every 21st.dev candidate that is evaluated, adapted, rejected, or rolled back gets a permanent row, even after substantial adaptation. Never remove rows; append status changes in Notes.

| ID | Page | Section | Component | 21st URL | Author | Source project | Date reviewed | Dependencies | Licence status | Decision | Adaptation location | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EX-1 *(example only — not a real evaluation)* | Product Overview | FAQ | *Example Accordion* | `https://21st.dev/…` *(illustrative)* | *author-handle* | *origin-ui (illustrative)* | 2026-07-22 | none | MIT stated on source project; Marketplace terms reviewed 2026-07-22 | *Recommended (example)* | `apps/landing/src/components/FaqAccordion.tsx` *(illustrative)* | Example row showing expected completeness; delete nothing, mark examples clearly |
| EX-2 *(example only)* | Developers | Code block | *Example CopyBlock* | `https://21st.dev/…` *(illustrative)* | *author-handle* | — | 2026-07-22 | `clsx` (would require approval) | Licence unclear → escalated | *Reject (example)* | — | Example of an escalation/rejection record |
| PO-NAV-001 | Product Overview / global nav | Primary navigation (mega-menu) | Dorpdown Navigation | https://21st.dev/@ln-dev7/components/dorpdown-navigation | LN (@ln-dev7) | ui.lndev.me (vercel-navbar) | 2026-07-22 | lucide-react, framer-motion (both unapproved) | Not stated on page — **Production blocked — requires clarification** (structural reference only; no code copied) | Possible with conditions — structural reference; implementation deferred to nav-redesign task | — (none; Stage 0) | User-supplied candidate; hover-led mechanics — full keyboard/Escape/outside-click layer to be built during adaptation; rebuild native (no deps) |
| PO-HERO-001 | Product Overview | Hero | Woven Light Hero | https://21st.dev/@dhileepkumargm/components/woven-light-hero | Dhileep Kumar GM (@dhileepkumargm) | — (none listed) | 2026-07-22 | three, framer-motion (both unapproved) | Not stated on page — **Production blocked — requires clarification** (visual reference only; no code copied) | **Recommended as visual reference only** — original implementation (Three.js particle field, continuous cursor-reactive rendering) conflicts with approved zero-idle background/performance rules; visual idea adapted as static/draw-once "Resomix Woven Signal Hero" | docs/page-demos/product/ (demo-only SVG adaptation) | User-selected; 'thousands of light particles react to cursor' per official description; theme-aware quality noted |

Rules: official 21st.dev pages only · no scraped data · no Marketplace preview media stored here or anywhere in the repo · licence uncertainty = production block + user escalation (COMPONENT_ADOPTION_POLICY §4).

## Change history

- 2026-07-22 — Register created (examples only). Author: Claude.
- 2026-07-22 — PO-NAV-001 added (user-supplied mega-menu candidate; licence clarification required). Author: Claude.
- 2026-07-22 — PO-HERO-001 added (Woven Light Hero — visual reference only; adaptation in /product demo). Author: Claude.
