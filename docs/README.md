# Documentation

Checked against the code on 7 October 2026. Anything that was true once and is not true now
is in [outdated/](outdated/), grouped and explained.

Two documents live at the repository root because they are the ones everybody needs.
[`README.md`](../README.md) is the monorepo guide, and [`instructions.md`](../instructions.md)
is the engineering rulebook.

---

## Start here

| Document | Covers |
|---|---|
| [`../instructions.md`](../instructions.md) | **The rulebook.** Eight non-negotiables, the repo map, environment setup, imports, barrels, assets, hooks, the design system, responsive strategy, adding a route, i18n, and the pre-push checklist |
| [ONBOARDING.md](ONBOARDING.md) | Getting set up, the git workflow, and what to check before opening a pull request |
| [ROUTES.md](ROUTES.md) | The API endpoint reference |

For how the system is put together, meaning the monorepo, the composition path, routing,
bundling, state and styling, see `official-documentation/systems/05-web-frontend.md`.

## Reference

| Folder | Covers |
|---|---|
| [reference/](reference/) | Auth flow, the SEO and structured-data references, the GSC baseline, the waveform integration, the component inventory, and two performance analyses |

## Archive

| Folder | Covers |
|---|---|
| [outdated/](outdated/) | 38 superseded documents in five groups. One of them was being cited as the live design system and is not |

---

## Three things to know before changing anything

**The design tokens live in `packages/ui/src/design-system/`.** That directory and its
README are the source. An older `docs/DESIGN_SYSTEM.md` described a different set that was
never shipped, and it is archived.

**The landing site prerenders and its SEO behaviour is tested.** The build fails on a
missing or future `lastmod`, and around 30 specs assert properties of the built output. A
change that looks cosmetic can fail the build, and that is the point.

**Desktop and mobile are two code paths.** Change one, check the other.
