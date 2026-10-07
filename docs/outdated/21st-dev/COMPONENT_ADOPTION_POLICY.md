# Component Adoption Policy

Status: Draft — awaiting approval (Gate 2)
Repository snapshot: `george-updates` at `2e00707`
Last reviewed: 2026-07-22

## 1. Reuse-first (mandatory gate)

Before any 21st.dev search, inspect: `packages/ui/src/index.ts`, `apps/landing/src/components/index.ts`, `apps/landing/src/sections/`, `packages/hooks/src/index.ts`. Classify the need: (1) reuse unchanged · (2) extend safely (backwards-compatible prop; consumer audit per IMPLEMENTATION_RULES §8) · (3) new Resomix-specific component · (4) external interaction-pattern research may help. **Search 21st.dev only for category 4.** If an existing component solves the need, external code is prohibited.

## 2. Selection criteria (summary; full matrix in templates/COMPONENT_EVALUATION.md)

Functional fit (exact interaction, keyboard, focus, mobile, no feature bloat) · Vite/React 19/React Router compatibility (reject or plan removal of `next/image`, `next/link`, App Router assumptions, server components/actions, Next metadata/route handlers, framework env access, unnecessary `"use client"`, Vercel-only packages) · Resomix Tailwind compatibility (all `p-4`/`gap-6`/`text-sm`/`rounded-xl`/`w-64`/raw px/foreign colours converted to `var(--px-*)`, colour tokens, font utilities, dotted borders, theme rules — never a second token system) · Visual fit (adaptable to Space Black, white/grey hierarchy, orange actives, Helvetica/Fira/Benzin, dotted structure, SideLines, Void Field, premium restraint; reject identities built on gradients/glass/large rounded cards/illustration/decorative glow/proprietary imagery/continuous animation) · Performance (reject or escalate continuous rAF, WebGL, canvas loops, shaders, video, heavy blur, backdrop filters, scroll hijacking, big animation packages, particles; prefer static-first, CSS/SVG, native disclosure, IO, one-time transform/opacity, reduced-motion parity) · Accessibility (semantics, keyboard, focus, escape, outside-click, SR labels, headings, contrast, touch targets, no hover-only or colour-only meaning).

## 3. Dependency policy

Default: **zero new dependencies.** Check for assumed shadcn/ui, Radix, Headless UI, Framer Motion, GSAP, Lucide, Tabler, CVA, clsx, tailwind-merge, `cn()` helpers, theme providers. Preference order: (1) existing Resomix primitive → (2) native React/DOM → (3) small self-contained adaptation → (4) new dependency only with explicit user approval recorded in the adaptation spec. Never modify `package.json`/lockfile outside an approved Cursor task.

## 4. Source, terms, and licensing

Per candidate record (in SOURCE_REGISTER.md and the evaluation): 21st.dev URL, component name, author, source project, published date, dependencies, source availability, underlying licence where clearly provided, Marketplace-terms review date, preview-media presence, assets to exclude, attribution obligations, commercial-use clarity. Rules: official platform only; no scraping; never copy Marketplace preview media (screenshots/videos/GIFs/thumbnails/descriptions) into Resomix; no redistribution of downloaded components; never publish 21st code as a Resomix library; **do not use in production when licence/permitted use is unclear — escalate to the user**; keep the source record even after substantial adaptation; never claim legal certainty the source doesn't provide.

## 5. Adaptation policy (sequence)

1 extract the useful mechanism (layout/state/a11y/interaction/responsive/animation logic) → 2 remove foreign identity (colours, type, spacing, radii, gradients, icons, images, copy, decorative animation, source naming) → 3 rebuild with Resomix primitives (`@resomix/ui`, buttons, forms, tokens, fonts, dotted borders, theme, route helpers, `useResponsive`, asset conventions) → 4 simplify dependencies (replace with existing/native; never keep one "because the source used it") → 5 place correctly (page-specific → `apps/landing/src/components/` or section dir; never unproven code into `packages/ui`) → 6 rename to project conventions (no source-library branding) → 7 validate (mobile/desktop/wide, dark/light, keyboard/focus, reduced motion, build, a11y, no unexpected deps/assets/drift).

## 6. Component maturity model

**Stage 0** external reference — link + evaluation only, no code in repo. **Stage 1** isolated adaptation — page-specific implementation, no shared export unless the page requires it. **Stage 2** reused landing primitive — proven on ≥2 landing pages, API/styling reviewed, may live in `apps/landing/src/components/`. **Stage 3** shared Resomix primitive — demonstrated cross-app reuse + consumer audit, only then `packages/ui`. **Never skip Stage 0 → Stage 3.**

## 7. Rejection and rollback

Reject on: any §2 hard failure, unclear licence, dependency without approval, visual identity that resists Resomix adaptation, cheaper-to-build-custom. Rollback: if a merged adaptation later shows drift/regressions, revert the surgical diff (small by design), mark the register row `rolled back` with reason, and either re-adapt or build custom. Duplicated capability found later → consolidate to one implementation via a new surgical task.

## Change history

- 2026-07-22 — Initial policy. Author: Claude.
