# Search Playbook

Status: Draft — awaiting approval (Gate 2)
Repository snapshot: `george-updates` at `2e00707`
Last reviewed: 2026-07-22

## From page need to search terms

Name the *interaction*, not the look: start from the PAGE_BRIEFS section, strip all Resomix identity words, and describe the mechanic + platform + qualities: `<mechanic> React Tailwind <quality>`. Good: `accessible mega menu React Tailwind keyboard`. Bad: `dark premium hero space` (identity — never sourced externally).

Example discovery searches (not instructions to install the first result):

```text
accessible mega menu React Tailwind keyboard
technical tabs React responsive
API code block copy button React
audience selector list React
FAQ accordion accessible React
split CTA enterprise self serve React
```

## Limiting candidates

Maximum **3 candidates per need** (search brief field). Stop collecting as soon as one candidate scores "Recommended" — quality and fit, not volume. If page one of results is all glass/gradient/bento, stop and recommend custom build.

## Inspecting a candidate

1. **Dependencies** (component page lists them; shadcn-registry JSON shows `dependencies`/`registryDependencies`): flag Radix/Framer Motion/GSAP/icon libs/CVA/clsx/tailwind-merge/`cn()`.
2. **Next.js assumptions**: search the source for `next/`, `use client`, `Image`, `Link`, `usePathname`, `headers()`, server actions, metadata exports.
3. **Generic visual drift**: gradients, glass blur, `rounded-2xl+` everywhere, colourful illustration, glow-by-default, bento grids — if identity depends on them, reject (ADOPTION_POLICY §2).
4. **Accessibility**: keyboard walkthrough in the live preview; check focus rings, escape/outside-click, ARIA attributes in source, heading semantics, reduced-motion handling.
5. **Performance**: search source for `requestAnimationFrame`, `canvas`, `WebGL`, `setInterval`, scroll listeners without passive/rAF, full-screen `backdrop-filter`, looping keyframes.

## Recording

Every consulted candidate — chosen or rejected — gets a SOURCE_REGISTER.md row and an evaluation file. Preview media is looked at on 21st.dev, never copied into this repository.

## Build vs adapt decision

Adapt when the mechanic is genuinely non-trivial (focus management, positioning, overflow orchestration) and the candidate is clean under §2 checks. Build custom when the mechanic is simple (a details/summary accordion, a two-column CTA), when every candidate drags dependencies, or when adaptation effort ≥ writing it natively with `@resomix/ui`. When in doubt: native first — the repo already has buttons, forms, modals, tooltips, and disclosure patterns.

## Change history

- 2026-07-22 — Initial playbook. Author: Claude.
