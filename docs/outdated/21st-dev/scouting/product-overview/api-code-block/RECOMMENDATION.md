# Recommendation — API code block

**What we need:** a reusable code block with copy action for real sandbox/API examples across Product Overview, Developers, and Integrations.

**Why the repository (mostly) solves it:** `PartnersPage.tsx` already implements copy-to-clipboard with success feedback, copy icons, and curl presentation — live on production `/partners`. The mechanic exists; only reusability is missing.

**Candidates inspected:** none — the reuse audit reclassified this need to "extend existing safely", which stops external research per COMPONENT_ADOPTION_POLICY §1.

**Recommendation:** **extend the existing Resomix curl-copy pattern into a reusable landing component** (`CodeBlock`-style, `apps/landing/src/components/`, Stage 1→2): extract the clipboard + feedback logic, add `<pre>/<code>` semantics, aria-live copied announcement, text-based feedback, mobile overflow, dotted-frame styling via tokens. Zero dependencies, zero licence surface, already on-brand.

**Decision for the user:** approve extending the existing pattern (recommended), or share an external candidate that demonstrably exceeds it.
