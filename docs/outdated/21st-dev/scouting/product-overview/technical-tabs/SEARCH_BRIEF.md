# Component search brief — Responsive technical tabs

Page: Product Overview (later: Track Intelligence, Developers)
Route: `/product` (then `/product/track-intelligence`, `/developers`)
Section: platform-surface switching; measured/predicted views; request/response examples
User goal: switch between related technical panels without page navigation
Interaction required: tablist semantics, arrow-key navigation, roving tabindex (or equivalent), selected-state semantics, dynamic panel content, mobile fallback (stack or select)
Existing Resomix components inspected: full `packages/ui` barrel — **no tabs primitive**; `ToggleButton` (binary toggle only); webapp search-mode select (native select — a valid mobile fallback pattern); no hooks
Why existing components are insufficient: nothing implements tablist keyboard semantics or panel association
Classification (§5 re-audit): **4 — external research remains justified** (a11y-correct tabs are a known-subtle pattern)
Required responsive behaviour: horizontal tablist ≥1024; stacked or select fallback below
Required accessibility behaviour: `role=tablist/tab/tabpanel`, `aria-selected`, arrow keys, visible focus, reduced-motion parity, URL-independent
Allowed dependencies: none (native React + DOM preferred)
Prohibited dependencies: Radix/Headless UI/motion/carousel libs — reject unless a meaningful a11y advantage would be costly to reproduce
Performance limits: no continuous animation; instant or ≤200ms opacity panel switch
Resomix visual constraints: Fira uppercase tab labels, dotted underline/border states, orange active indicator, tokens, both themes
Search terms: `accessible tabs React Tailwind keyboard` · `technical tabs React responsive` · `React tabs roving tabindex` · `responsive tabs mobile select React` · `accessible segmented technical interface React`
Maximum candidates: 3

## Status — awaiting candidates

Access limitation (2026-07-22): official listing pages render only category counts server-side (Tabs category: 146 components confirmed at `https://21st.dev/community/components/s/tabs`); the card grids are client-rendered, so candidates could not be shortlisted without interactive browsing or MCP. Per the agreed flow, **the user shares candidate links** (or approves MCP/browser access), and each shared link gets a full evaluation (component pages render completely, as PO-NAV-001 proved). Interim default if no candidate arrives: **custom native implementation** — a WAI-ARIA tabs pattern is ~60 lines and fully within reach of existing conventions (Stage 1, likely Stage 2 at the second consumer).
