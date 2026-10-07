# Component evaluation — Mega-menu mechanics

## Candidate PO-NAV-001 — "Dorpdown Navigation" (user-supplied)

### Source metadata (from the official component page, reviewed 2026-07-22)

- Component name: Dorpdown Navigation ("A dynamic and interactive multi-level navigation menu with dropdown submenus and hover effects")
- 21st.dev URL: `https://21st.dev/@ln-dev7/components/dorpdown-navigation` (variant: `/with-tabs`)
- Author: LN (`@ln-dev7` — lndev-ui author, 30 components on 21st.dev)
- Source project: `ui.lndev.me/components/vercel-navbar` (a Vercel-navbar-style component)
- Published: 27 Jan 2025 · Date reviewed: 2026-07-22
- Install commands shown officially: `npx @21st-dev/cli add ln-dev7/dorpdown-navigation`; user-supplied shadcn form `npx shadcn@latest add "https://21st.dev/r/ln-dev7/dorpdown-navigation"` — **neither will be run**; policy is manual rebuild
- Dependencies (listed on page): **`lucide-react`, `framer-motion`** — both prohibited-by-default
- Registry dependencies: none listed
- Source availability: full source visible on the component page (Usage.tsx/Component.tsx tabs)
- Underlying licence: **not stated on the 21st.dev page**; ui.lndev.me licence not confirmed → *licence clarification required before any code-level reuse*
- Marketplace terms review date: 2026-07-22 (terms at 21st.dev/terms; component-level licence remains author/source-project dependent)
- Commercial-use clarity: unclear at component level → production use of *source code* blocked pending clarification; **pattern-level reference (structure only) carries no code reuse**
- Preview media: live preview + demo content (Vercel-style items) — nothing copied into this repo
- Assets to exclude: all demo copy (Vercel product names), lucide icons, motion animations

### Functional evaluation

Solves: multi-trigger top navigation where each trigger opens a **multi-column submenu panel** (column titles + items with label/description/icon) — structurally the exact shape of the approved Solutions/Product menus (WEBSITE_ARCHITECTURE §13–17). Unnecessary features: icon-per-item (Resomix uses text + Fira descriptors), tabs variant. State model: simple React state (active item id) — good. **Keyboard/focus/Escape/outside-click: not evidenced on the page; the description emphasises hover effects** — the a11y layer must be verified in source and, most likely, added during adaptation. Mobile: no built-in strategy (Resomix uses `MenuPage` below 1024 — acceptable). Hover-only access would violate the brief; adaptation must add click/focus triggers.

### Technical evaluation

React + Tailwind, TypeScript; no Next.js APIs visible in the demo usage; no server components; Vite-compatible after dependency removal. `framer-motion` used for panel transitions (replaceable with CSS transitions); `lucide-react` for icons (replaceable with text/Resomix icons). Complexity low→moderate; adaptation complexity moderate (a11y additions are the real work, not the layout).

### Resomix compatibility

Identity removal: clean — the value is the trigger/panel/column data model and layout, all styling replaceable with dotted borders, Fira labels, tokens (`var(--px-*)`), dark/light themes, Void Field compatibility. Post-adaptation it would render as: bracketed/Fira triggers in the existing Navbar row → full-width dotted panel with grouped columns (title + item + one-line descriptor), orange current-page marker.

### Performance evaluation

No rAF/canvas/WebGL/scroll listeners in evidence; motion is panel-level via framer-motion → replaced by short CSS transitions; no loops.

### Scores (1–5)

Functional fit **4** · Vite compatibility **4** · Dependency safety **2** (two prohibited deps) · Adaptation effort **3** · Accessibility **2** (hover-led; keyboard layer unproven) · Performance **4** · Licence clarity **2** (unstated) · Resomix adaptability **4**

### Decision

**Possible with conditions.** Conditions: (1) use as **structural reference only** — rebuild natively (no framer-motion, no lucide, no code copied while licence is unclear); (2) add the full keyboard/Escape/outside-click/focus layer during adaptation; (3) licence clarification before any literal code reuse; (4) implementation only inside the separate Navbar-redesign/consumer-audit task. No competing candidates were collected: the user selected this pattern, the decision is deferred to the nav phase (build-order decision), and one clean structural reference is sufficient for that later task; slots PO-NAV-002/003 stay open if the nav task wants alternatives.

### User approval

- [ ] Pattern approved as structural reference for the future nav task (Gate 5) — decision may be deferred to the nav phase
- SOURCE_REGISTER row: PO-NAV-001
