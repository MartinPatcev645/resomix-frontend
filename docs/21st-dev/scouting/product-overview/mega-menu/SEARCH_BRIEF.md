# Component search brief — Mega-menu interaction mechanics

Page: Product Overview (and all Phase 1 pages — shared navigation)
Route: global (shared `Navbar`)
Section: primary desktop navigation (Product / Solutions / Partners / Developers / Company)
User goal: open grouped dropdown/mega-menu panels and reach any page in ≤2 interactions, by mouse, keyboard, or touch
Interaction required: trigger↔panel disclosure, focus management, arrow/Tab navigation, Escape-to-close, outside-click close, one-open-at-a-time, mobile strategy
Existing Resomix components inspected: `packages/ui/src/index.ts` (full barrel — no menu/disclosure primitive), `Navbar.tsx` (three fixed `LinkButton`s + mode CTA; no dropdown system), `MobileNavbar` + landing `MenuPage` (full-screen overlay, flat links), `ProfileDropdown` (small single-panel dropdown — closest existing pattern, not multi-column), `packages/hooks` (no disclosure hooks)
Why existing components are insufficient: no multi-panel disclosure, no focus trap/roving focus, no keyboard model, no positioning logic; `ProfileDropdown` is single-column account UI
Classification (§5 re-audit): **4 — external interaction-pattern research remains justified**
Required responsive behaviour: desktop ≥1024 dropdown panels; below 1024 the grouped `MenuPage` overlay handles navigation (separate task)
Required accessibility behaviour: full keyboard operability, visible focus, Esc/outside-click close, semantic `nav`/list markup, no hover-only access
Allowed dependencies: none (default)
Prohibited dependencies: Radix, Headless UI, Framer Motion, GSAP, floating-ui, icon libraries — unless the interaction cannot be implemented safely without one (escalate)
Performance limits: no continuous animation; CSS transitions ≤300ms; no layout-thrashing positioning
Resomix visual constraints: bracketed Fira links, dotted panel borders, Void Field compatibility, dark+light themes; all source styling removed
Search terms: `accessible mega menu React Tailwind keyboard` · `navigation menu dropdown focus management React` · `React mega menu escape outside click keyboard` · `accessible multi-column dropdown React`
Maximum candidates: 3 (1 inspected — user-supplied; sufficient given the deferred build order)

Scope warning: shared `Navbar` affects landing + webapp. Any implementation runs through the separate Navbar-redesign/consumer-audit task (IMPLEMENTATION_RULES §8; WEBSITE_ARCHITECTURE §11–12) — never through a normal page task.
