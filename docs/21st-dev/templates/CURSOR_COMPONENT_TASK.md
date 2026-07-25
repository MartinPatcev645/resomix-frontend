# Cursor task — <Resomix component name> (surgical adaptation)

> Template only. A real task is generated only after Gate 6 approval.

## Contract

Implement exactly the approved adaptation spec: `docs/21st-dev/<...>/COMPONENT_ADAPTATION_SPEC` (link). Nothing outside it.

## Governing rules (read before editing)

- `docs/IMPLEMENTATION_RULES.md` — engineering rules, §30 change control, §32 validation
- `docs/DESIGN_SYSTEM.md` — visual rules and tokens
- `docs/21st-dev/COMPONENT_ADOPTION_POLICY.md` — adaptation sequence §5

## File scope (exact; no other files)

- create:
- modify:
- barrels/translations/layout-mode updates:

## Hard constraints

Smallest safe diff · no unrelated changes/formatting · no new dependencies (none approved unless listed in the spec) · Resomix tokens only (`var(--px-*)`, colour tokens, font utilities) · no Next.js remnants · no source-library naming or media · both themes · reduced-motion parity.

## Validation (all must pass)

```bash
pnpm --filter landing lint
pnpm --filter landing build
pnpm --filter landing test:unit
pnpm --filter landing test:a11y
git status --short && git diff --stat
```

Manual: 393 / 1280 / ≥1920 · dark + light · keyboard + focus · reduced motion.

## Completion report

Files changed · barrels updated · deps confirmed unchanged (`git diff pnpm-lock.yaml` empty) · validation output · deviations (should be none) · SOURCE_REGISTER row updated.
