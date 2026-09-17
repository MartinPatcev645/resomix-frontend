/**
 * Every marketing page has its own visual family, with page-prefixed classes for the section shell,
 * the eyebrow and the heading (`po-`, `sd-`, `dj-` and so on). The FAQ block is one shared
 * component, so it borrows those classes instead of inventing a twelfth look. Only the
 * question-and-answer list itself is styled in faq.css.
 *
 * The three shapes below are the three that exist in the sections today:
 *   product-style   section > div.X-wrap > div.X-eyebrow + h2.X-h2
 *   instrument      section > header.X-dim-intro > p.X-eyebrow + h2.X-h2b   (inside the page column)
 *   solution-style  section > div.X-frame > p.X-eyebrow + h2.X-h2b
 */

export interface FaqFamilyClasses {
  /** Section id, unique on the page (singleContentTree.spec.ts fails on a repeated section id). */
  id: string;
  section: string;
  /** Wrapper that carries the page's column width, where the family uses one. */
  inner?: string;
  /** Wrapper around the eyebrow and heading, where the family uses one. */
  header?: string;
  eyebrow: string;
  eyebrowTag: 'p' | 'div';
  h2: string;
}

const productStyle = (p: string): FaqFamilyClasses => ({
  id: `${p}-faq`,
  section: `${p}-sec ${p}-section`,
  inner: `${p}-wrap`,
  eyebrow: `${p}-eyebrow`,
  eyebrowTag: 'div',
  h2: `${p}-h2`,
});

const instrumentStyle = (p: string): FaqFamilyClasses => ({
  id: `${p}-faq`,
  section: `${p}-section`,
  header: `${p}-dim-intro`,
  eyebrow: `${p}-eyebrow uppercase`,
  eyebrowTag: 'p',
  h2: `${p}-h2b uppercase`,
});

const solutionStyle = (p: string): FaqFamilyClasses => ({
  id: `${p}-faq`,
  section: `${p}-section`,
  inner: `${p}-frame`,
  eyebrow: `${p}-eyebrow uppercase`,
  eyebrowTag: 'p',
  h2: `${p}-h2b uppercase`,
});

/** Keyed by the page's locale namespace, which is also where its `faq` copy lives. */
export const FAQ_FAMILIES = {
  product: productStyle('po'),
  catalogueIntelligence: productStyle('ci'),
  musicPublishers: productStyle('mp'),
  sonicDiscovery: instrumentStyle('sd'),
  trackIntelligence: instrumentStyle('ti'),
  djs: solutionStyle('dj'),
  musicCurators: solutionStyle('mcu'),
  producers: solutionStyle('pr'),
  recordLabels: solutionStyle('rl'),
  syncAgencies: solutionStyle('sa'),
  musicLibraries: solutionStyle('ml'),
} satisfies Record<string, FaqFamilyClasses>;

export type FaqNamespace = keyof typeof FAQ_FAMILIES;
