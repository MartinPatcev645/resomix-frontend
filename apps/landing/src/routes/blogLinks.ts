/**
 * Canonical blog URLs for the contextual links defined in the interlinking map
 * (AA_Resomix_Docs/Resomix/GSP-SEO, "Resomix Interlinking Map — Corrected v2", section 5).
 *
 * Defined once so all 30 links stay byte-identical to the map and a URL can be corrected in one
 * place. The map's rules for these links, which the QA crawl checks:
 *
 *   - absolute URLs, blog paths keep the trailing slash (the main site drops it, so a missing or
 *     extra slash costs a redirect hop on every link)
 *   - plain `<a href>` present in the server-rendered HTML, never injected after load
 *   - no rel="nofollow", no rel="sponsored", no UTM parameters
 *   - in body copy or a card description, never inside a heading
 *   - one link per destination per page, at its first relevant mention
 *
 * One deliberate departure from the map, agreed on 3 October: these open in a new tab. The map
 * forbids `target="_blank"` and gives the reason "they should open in the same tab and pass
 * authority", but the target attribute has no bearing on how a link is crawled or what it passes.
 * The map's QA crawl still tests for it, so expect that one row to flag and explain it rather than
 * silently reverting. `rel="noopener"` rides along, and is not one of the rel values the map bans.
 *
 * Anchor text lives in `src/locales` next to the copy it sits in; these are only the destinations.
 * Rendered through react-i18next's `<Trans components={{ a: <a href={BLOG.x} /> }} />`, which keeps
 * the anchor inside the translated sentence and still emits a real anchor during prerender.
 */
export const BLOG = {
  /** Discovery cluster, parent product Sonic Discovery. */
  techno: 'https://blog.resomix.com/how-to-find-new-techno-music/',
  ambient: 'https://blog.resomix.com/ambient-music-for-sleep-no-beat-no-melody/',
  /** Catalogue cluster, parent product Catalogue Intelligence. */
  backCatalogue:
    'https://blog.resomix.com/how-your-labels-back-catalogue-becomes-a-reliable-revenue-stream/',
  beyondTags:
    'https://blog.resomix.com/beyond-tags-and-metadata-better-music-discovery-for-record-labels/',
  discoveryRevenue:
    'https://blog.resomix.com/music-discovery-as-a-new-revenue-stream-the-resomix-approach/',
  /** Bridge post, links both clusters. */
  supervisors: 'https://blog.resomix.com/resomix-for-music-supervisors-and-curators/',
  /** Brand post. */
  story: 'https://blog.resomix.com/the-story-behind-resomix/',
} as const;
