# Recommendation — Responsive technical tabs

**What we need:** accessible tabs for platform-surface switching (Product Overview), measured/predicted views (Track Intelligence), request/response examples (Developers).

**Why the repository doesn't solve it:** no tabs primitive exists in `packages/ui`; `ToggleButton` is binary; nothing implements tablist semantics.

**Candidates inspected:** none yet — official listing grids are client-rendered (category confirmed: 146 tabs components), and per the agreed flow the user supplies candidate links for evaluation.

**Recommendation (interim):** **hold the external decision; default to a custom native Resomix tabs component if no compelling candidate is shared.** The WAI-ARIA tabs pattern (roving tabindex + arrow keys + `aria-selected` + panel association) is small, dependency-free, and fully specifiable — a candidate must beat that baseline on real merit (e.g., an unusually good responsive fallback), not on styling.

**Decision for the user:** share 1–3 tab candidates from 21st.dev for evaluation, **or** approve the custom native build now (Stage 1 on Product Overview; Stage 2 review when Track Intelligence/Developers reuse it).
