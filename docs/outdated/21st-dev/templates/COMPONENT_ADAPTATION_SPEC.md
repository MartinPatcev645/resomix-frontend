# Component adaptation spec — <Resomix component name>

Approved candidate: <SOURCE_REGISTER ID + URL>
Page/section: <route + brief section>

## Useful mechanism retained

(layout mechanic / state model / a11y pattern / interaction logic / responsive behaviour / animation behaviour)

## Source identity removed

(colours, typography, spacing, radii, gradients, icons, images, copy, decorative animation, source naming — list what gets stripped)

## Resomix components reused

(`@resomix/ui` primitives, buttons, form elements, vectors, hooks)

## Token mapping

| Source value | Resomix token |
|---|---|
| e.g. `p-4` | `p-[var(--px-16)]` (confirm step exists in pixels.css) |

## Dependency plan

(source deps → existing/native replacements; any *approved* new dep with approval date; default none)

## File plan

(exact files to create/modify — page-specific placement first; barrels; translations; layout mode)

## Responsive plan

(desktop/mobile behaviour, breakpoint, mobile simplification)

## Accessibility plan

(semantics, keyboard, focus, escape/outside-click, SR labels, reduced motion)

## Performance plan

(static-first; one-time transitions only; no loops; IO gating if any)

## Source record

(SOURCE_REGISTER row updated: yes/no + ID)

## Acceptance criteria

(IMPLEMENTATION_RULES §32 suite + both themes + 393/1280/1920 + keyboard + reduced-motion + zero unexpected deps + no visual drift vs approved design)

## User approval

- [ ] Spec approved by user on: ____ (pre-Gate 6)
