# Recommendation — Mega-menu mechanics

**What we need:** grouped dropdown panels for Product/Solutions/Partners/Developers/Company with real keyboard, focus, Escape, and outside-click behaviour, on the shared `Navbar`.

**Why the repository doesn't solve it:** the current `Navbar` renders three fixed links; `ProfileDropdown` is a single-column account menu; no disclosure/focus-management primitive exists anywhere in `packages/ui` or `packages/hooks`.

**Candidates inspected:** one — PO-NAV-001 "Dorpdown Navigation" (`https://21st.dev/@ln-dev7/components/dorpdown-navigation`), supplied by the user.

**Recommendation:** **Accept PO-NAV-001 as the structural reference, with conditions — and defer the whole mega-menu implementation to the end of the build, after all pages exist.** The deferral (user's proposal) is the right call: the menu must not ship dead links, the nav is shared cross-app (highest-risk change), and every page is reachable meanwhile through existing nav, footer, and direct routes.

**Why this candidate:** its data model (triggers → multi-column panels → grouped items with descriptors) is exactly the approved IA shape; state model is simple React; the layout survives complete re-skinning.

**What must be removed:** framer-motion (→ CSS transitions), lucide-react (→ text/Resomix vocabulary), all Vercel-style demo content, hover-only triggering, all source styling.

**Dependencies:** lucide-react + framer-motion — **not approved**; the rebuild uses zero new dependencies.

**Rebuild approach:** native React state + refs; click/Enter/Space triggers with hover as enhancement; roving arrow-key focus; Esc/outside-click close; panels styled with dotted borders/Fira/tokens; wired through the existing `handleNavigate`/`LinkButton` conventions; implemented only inside the separate Navbar-redesign + consumer-audit task.

**After adaptation it looks like:** the current Resomix nav row, unchanged in voice, with full-width dotted panels underneath — no trace of the source's identity.

**Custom-vs-adapt:** a fully custom build would also be safe; the candidate mainly saves layout/structure decisions. Either path is low-regret because the a11y layer is written by us in both cases.

**Decision for the user:** approve PO-NAV-001 as structural reference (conditions above) + confirm the mega-menu is scheduled **last**, after all Phase 1 pages.
