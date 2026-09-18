import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROUTE_SEO } from '@/routes/seoConfig.ts';

/**
 * The page must appear in the DOM exactly once.
 *
 * `SideLines` used to render `{children}` — the whole page — twice: one copy inside
 * `hidden lg:block`, another inside `block lg:hidden`. `display: none` skips layout and paint, but
 * the browser still downloads, parses and style-matches the hidden copy. On the homepage that was
 * 2,573 DOM nodes and 187 KiB of markup where 1,297 and 95 KiB do the same job.
 *
 * Desktop never showed it (~10 Mbps, no CPU throttle — a steady 99). The throttled mobile profile
 * did: LCP 4.7 s, of which 1,000 ms was "element render delay" while TTFB was 20 ms. Nothing was
 * waiting on the network; the browser was busy with markup it would never display.
 *
 * A regression here is invisible in review and invisible on desktop, so it is asserted against the
 * built HTML — the bytes a browser actually receives.
 */


const DIST = resolve(process.cwd(), 'dist');
const built = existsSync(resolve(DIST, 'index.html'));
const html = (route: string) =>
  readFileSync(resolve(DIST, route === '/' ? 'index.html' : `${route.slice(1)}.html`), 'utf8');

/** Contents of `#root` — the rendered page, excluding the shell's head and scripts. */
const rootOf = (src: string) => {
  const open = src.indexOf('<div id="root">');
  return src.slice(open + '<div id="root">'.length, src.indexOf('</body>', open));
};

describe.skipIf(!built)('the page is rendered once, not per breakpoint', () => {
  const routes = Object.keys(ROUTE_SEO).filter((r) => r !== '/404' && !ROUTE_SEO[r].noindex);

  it('never repeats a <section> id', () => {
    const offenders: string[] = [];
    for (const route of routes) {
      const ids = [...rootOf(html(route)).matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
      const repeated = ids.filter((id, i) => ids.indexOf(id) !== i);
      if (repeated.length) offenders.push(`${route}: ${[...new Set(repeated)].join(', ')}`);
    }
    expect(offenders, 'these routes render their sections more than once').toEqual([]);
  });

  it('renders the hero heading exactly once per page', () => {
    const offenders = routes.filter((r) => (rootOf(html(r)).match(/<h1[\s>]/g) ?? []).length !== 1);
    expect(offenders, 'these routes have zero or duplicate H1s').toEqual([]);
  });

  /**
   * The check above reads `#root`, which is where headings belong. This one reads the WHOLE
   * document, because the shell's comments ship to production too.
   *
   * On 18 September 2026 Bing's Live URL test reported the homepage as having two h1 elements. A
   * conforming parser sees one: the second was the text `<h1>` inside a comment in index.html
   * explaining which font the hero uses. Bing's on-page checker counts tag names inside comments,
   * and Bing is what ChatGPT and Copilot search through, so being technically right was not worth
   * the error badge. Write tag names out in prose instead.
   */
  /**
   * The h1 check above reads the prerendered HTML, which is everything a crawler is served but NOT
   * everything a browser ends up with. The cookie consent modal is built by a script at runtime,
   * and the Silktide default gave its title a level-one heading, so every page of the site had two
   * as soon as that modal existed. Nothing in the prerendered markup could show it, which is why it
   * survived until Bing's on-page check reported it on 18 September 2026.
   *
   * This reads the script we actually ship.
   */
  it('the consent modal does not add a second top-level heading at runtime', () => {
    const script = resolve(DIST, 'scripts/resomix-consent.js');
    if (!existsSync(script)) return;
    const source = readFileSync(script, 'utf8');
    const headings = source.match(/<h1[\s>]/g) ?? [];
    expect(headings, 'the consent modal must not use a level-one heading').toEqual([]);
  });

  it('never writes a tag name as markup inside a comment in the shipped HTML', () => {
    const offenders: string[] = [];
    for (const route of routes) {
      const comments = html(route).match(/<!--[\s\S]*?-->/g) ?? [];
      const guilty = comments.filter((c) => /<(h[1-6]|title|main|nav|body|html)[\s>]/i.test(c));
      if (guilty.length) offenders.push(route);
    }
    expect(offenders, 'naive on-page checkers count these as real elements').toEqual([]);
  });

  it('keeps the homepage DOM under the size the duplicate tree forced', () => {
    // Was 2,573. A generous ceiling: this is a guard against the duplication returning, not a
    // budget for the design.
    const elements = (rootOf(html('/')).match(/<[a-zA-Z][^>]*>/g) ?? []).length;
    expect(elements, `homepage DOM is ${elements} elements`).toBeLessThan(1800);
  });

  it('still renders both frames, which genuinely do differ by breakpoint', () => {
    // The merge removed the duplicate CONTENT, not the per-breakpoint decoration.
    const root = rootOf(html('/'));
    expect(root, 'desktop frame rules missing').toContain('hidden lg:block');
    expect(root, 'mobile frame rules missing').toContain('block lg:hidden');
  });
});
