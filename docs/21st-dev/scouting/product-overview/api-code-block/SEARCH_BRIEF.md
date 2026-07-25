# Component search brief — API code block with copy action

Page: Product Overview (later: Developers, Integrations)
Route: `/product` (then `/developers`, `/partners/integrations`)
Section: sandbox/API examples (the real verified curl call)
User goal: read and copy a working API example with clear feedback
Interaction required: `<pre>/<code>` semantics, horizontal mobile overflow, copy button with visible non-colour-only feedback, keyboard accessible, SR-labelled, graceful clipboard failure
Existing Resomix components inspected: **`apps/landing/src/pages/PartnersPage.tsx` already implements the full mechanic** — `navigator.clipboard` copy with `copyKeySuccess`/`copyCurlSuccess` state feedback, custom copy/copy-hover SVG icons, curl block presentation ("Copy Key" / "Copy Curl", verified live on production `/partners`); Fira styling conventions; dotted panels
Why existing components are insufficient: they are not insufficient — the pattern is page-local and needs extraction into a reusable landing component, not replacement
Classification (§5 re-audit): **2 — existing component can be extended safely.** External research is **no longer justified**; per policy §1, 21st.dev search for this need is stopped.
Required responsive behaviour: horizontal scroll on mobile; no wrap-breaking of commands
Required accessibility behaviour: as above; copied-state announced (aria-live) and shown as text change, not colour alone
Allowed dependencies: none (native Clipboard API — already in use)
Prohibited dependencies: syntax-highlighting libs, icon libs
Performance limits: static; no animation beyond a ≤200ms feedback transition
Resomix visual constraints: existing dotted frame + Fira code styles; real sandbox content only; no fake telemetry
Search terms: (not used — research stopped at classification 2)
Maximum candidates: 0
