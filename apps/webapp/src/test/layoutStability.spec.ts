import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The three things that made this app score 53 mobile / 61 desktop, none of which are about SEO.
 *
 * PageSpeed measured CLS 0.192 mobile / 0.211 desktop, and unlike the marketing site it was NOT
 * mostly font swap:
 *
 *   0.150  the global footer, pushed down as the workspace data arrived
 *   0.059  #webapp-page-root, from the beta notice appearing after first paint
 *
 * Plus TBT 510-570 ms, of which PostHog is ~409 ms of main-thread time.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
/** Comments explain the same things they assert; strip them before matching. */
const code = (src: string) => src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('layout stability', () => {
  it('reserves a full viewport for the page so the footer starts below the fold', () => {
    // At min-h-[50vh] the footer sat just inside the fold and moved when content loaded.
    const layout = code(read('src/components/Layout/WebLayout.tsx'));
    expect(layout).toMatch(/className="page-transition flex-1 min-h-screen/);
    expect(layout, 'the old 50vh floor is what caused the 0.150 shift').not.toContain('min-h-[50vh]');
  });

  it('renders the beta notice by default, so it cannot appear after paint', () => {
    const src = code(read('src/components/OptionalAuthRoute.tsx'));
    expect(src).toContain('useState(true)');
    // Corrected before paint, not after: a plain effect would still flash for dismissed visitors.
    expect(src).toMatch(/useIsomorphicLayoutEffect\(/);
  });

  it('hides the notice from the shell for anyone who dismissed it', () => {
    const shell = code(read('index.html'));
    expect(shell).toMatch(/localStorage\.getItem\("demo_stage_notice_dismissed"\)/);
    expect(shell).toMatch(/\[data-demo-dismissed\]\s*\[data-demo-banner\]\s*\{\s*display:\s*none/);
  });
});

describe('third-party staging', () => {
  it('defers the tag manager to 4s, matching landing', () => {
    // PostHog is loaded BY the GTM container, so deferring GTM defers both.
    expect(code(read('src/App.tsx'))).toContain('useAfterIdle(4000)');
  });
});

describe('llms.txt', () => {
  const path = 'public/llms.txt';

  it('exists — its absence was the Agentic Browsing 1/2', () => {
    expect(existsSync(resolve(process.cwd(), path))).toBe(true);
  });

  it('has a single H1 and real links, which is what the audit checks', () => {
    const txt = read(path);
    expect(txt.match(/^# /gm)).toHaveLength(1);
    expect((txt.match(/\]\(https:\/\//g) ?? []).length).toBeGreaterThan(3);
  });

  it('points at the marketing site for what the product IS', () => {
    // This origin is the app; resomix.com carries the description and the canonical shared pages.
    expect(read(path)).toContain('https://resomix.com/');
  });
});
