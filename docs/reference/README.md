# Reference

Still useful, narrower than the rulebook, and not where to start.

## The system

| Document | Covers | Note |
|---|---|---|
| [AUTH_FLOW.md](AUTH_FLOW.md) | Login, registration, refresh, password reset and two-factor, end to end | November 2025. The flows it describes are still accurate, but it predates Google sign-in, email verification, the sessions list and the profile endpoints. Treat it as the core flow rather than the full surface |
| [REUSABLE_COMPONENTS.md](REUSABLE_COMPONENTS.md) | An inventory of shared components | October 2025. `packages/ui` has grown since, so read it as a starting point and check the barrel |
| [HOWLER_PEAKS_INTEGRATION.md](HOWLER_PEAKS_INTEGRATION.md) | The waveform and peaks integration, 724 lines | May 2026. The deepest account of how peaks are fetched, cached and drawn |

## Search and structured data

| Document | Covers |
|---|---|
| [SEO_AND_PERFORMANCE.md](SEO_AND_PERFORMANCE.md) | The SEO and performance work, 832 lines |
| [SEO_METADATA_ALL_PAGES.md](SEO_METADATA_ALL_PAGES.md) | Title, description and metadata per page |
| [STRUCTURED_DATA_PLAN.md](STRUCTURED_DATA_PLAN.md) | How the JSON-LD is built and which schemas are used |
| [NOINDEX_STAGING_AND_BETA.md](NOINDEX_STAGING_AND_BETA.md) | Keeping staging and beta out of the index |
| [GSC_BASELINE_1_OCT_2026.md](GSC_BASELINE_1_OCT_2026.md) | The Search Console baseline the October clean-up is measured against. **Still live**, the re-check compares to these numbers |

## Two analyses whose outcome is not recorded

Both are February 2026 and both read as current documents. Neither says whether the problem
was solved, which is the main reason to be careful with them.

| Document | Covers |
|---|---|
| [SITE_USAGE.md](SITE_USAGE.md) | Which pages use WebGL and animation, and how resource-intensive each is |
| [STABILITY_PLAN.md](STABILITY_PLAN.md) | A black screen when many tabs are open. The diagnosis is that browsers cap active WebGL contexts, around 16 on desktop Chrome and fewer on mobile Safari, and kill the oldest when the cap is hit. It proposes several fixes |

The `STABILITY_PLAN.md` diagnosis is sound and the cause is a browser limit rather than a
defect in our code. Whether any of its proposed fixes were applied is not written down
anywhere, so it is worth confirming before anyone spends time rediscovering it.
