import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Every hero headline uses one scale, taken from /product/catalog-intelligence:
 * 32px mobile → 36px tablet (≥768) → 48px desktop (≥1024), weight 900. Hero blocks all use the
 * homepage's 44/52 padding-block.
 *
 * Before this the 17 heroes each picked their own: desktop sizes ranged 46→76px, weights were 700,
 * 900 or undeclared, and padding-block ranged 21→96px. Nothing enforced agreement, so each new page
 * drifted again. These assertions are the enforcement — they read the CSS the pages actually ship.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const css = (rel: string) => read(`src/sections/${rel}`);

/** page prefix → [css file, h1 class]. Null h1 = the headline carries the scale as utilities. */
const PAGES: Array<[string, string, string | null]> = [
  ['ab', 'about/about.css', 'ab-h1'],
  ['ci', 'catalogue-intelligence/catalogue-intelligence.css', 'ci-h1'],
  ['dev', 'developers/developers.css', 'dev-benzin-d'],
  ['dj', 'djs/djs.css', 'dj-benzin'],
  ['hm', 'home/home.css', 'hm-benzin'],
  ['mcu', 'music-curators/music-curators.css', 'mcu-benzin'],
  ['ml', 'music-libraries/music-libraries.css', 'ml-benzin'],
  ['mp', 'music-publishers/music-publishers.css', 'mp-h1'],
  ['pn', 'partners/partners.css', null],
  ['pp', 'partners-pilot/partners-pilot.css', null],
  ['pr', 'producers/producers.css', 'pr-benzin'],
  ['po', 'product/product.css', 'po-h1'],
  ['rl', 'record-labels/record-labels.css', 'rl-benzin'],
  ['sd', 'sonic-discovery/sonic-discovery.css', null],
  ['sa', 'sync-agencies/sync-agencies.css', 'sa-benzin'],
  ['ti', 'track-intelligence/track-intelligence.css', 'ti-benzin-d'],
  ['tr', 'trust/trust.css', null],
];

const INLINE_HEROES = [
  'partners/PnJunctionHero.tsx',
  'partners-pilot/PpProtocolHero.tsx',
  'trust/TrHero.tsx',
  'sonic-discovery/SdSearchFieldHero.tsx',
];

const ALL_HEROES = [
  'about/AbHero.tsx', 'catalogue-intelligence/CiHero.tsx', 'developers/DevRequestRouterHero.tsx',
  'djs/DjHero.tsx', 'home/HmHero.tsx', 'music-curators/McuHero.tsx', 'music-libraries/MlHero.tsx',
  'music-publishers/MpHero.tsx', 'producers/PrHero.tsx', 'product/PoHero.tsx',
  'record-labels/RlHero.tsx', 'sync-agencies/SaHero.tsx', 'track-intelligence/TiAnatomyHero.tsx',
  ...INLINE_HEROES,
];

/** Strip comments so an example inside a comment cannot satisfy an assertion. */
const live = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');

describe('canonical hero title scale', () => {
  it.each(PAGES.filter((p) => p[2]))('%s sets 32/36/48 at weight 900', (pre, file, h1) => {
    const c = live(css(file));
    const sel = `.${pre}-page .${h1}`;
    expect(c, 'mobile').toMatch(new RegExp(`${escape(sel)}\\s*\\{[^}]*font-size:\\s*var\\(--px-32\\)`));
    expect(c, 'weight').toMatch(new RegExp(`${escape(sel)}\\s*\\{[^}]*font-weight:\\s*900`));
    expect(c, 'tablet').toContain('min-width: 768px');
    expect(c, 'tablet size').toMatch(new RegExp(`${escape(sel)}\\s*\\{\\s*font-size:\\s*var\\(--px-36\\)`));
    expect(c, 'desktop size').toMatch(new RegExp(`${escape(sel)}\\s*\\{\\s*font-size:\\s*var\\(--px-48\\)`));
  });

  it.each(INLINE_HEROES)('%s carries the same scale as utilities', (rel) => {
    const h1 = read(`src/sections/${rel}`).match(/<h1\s+className="([^"]+)"/)?.[1] ?? '';
    expect(h1).toContain('text-[length:var(--px-32)]');
    expect(h1).toContain('md:text-[length:var(--px-36)]');
    expect(h1).toContain('lg:text-[length:var(--px-48)]');
    // These four previously declared no weight and silently inherited font-light from the page root.
    expect(h1).toContain('font-black');
  });

  it('no hero keeps an off-scale headline size', () => {
    for (const [pre, file, h1] of PAGES) {
      if (!h1) continue;
      const sizes = [...live(css(file)).matchAll(new RegExp(`\\.${pre}-page \\.${h1}\\s*\\{([^}]*)\\}`, 'g'))]
        .flatMap((m) => [...m[1].matchAll(/font-size:\s*([^;]+)/g)].map((x) => x[1].trim()));
      expect(new Set(sizes), `${pre} has a stray headline size`).toEqual(
        new Set(['var(--px-32)', 'var(--px-36)', 'var(--px-48)']),
      );
    }
  });
});

describe('hero block spacing', () => {
  it.each(PAGES)('%s uses the homepage 44/52 padding-block', (pre, file) => {
    const c = live(css(file));
    expect(c).toMatch(new RegExp(`\\.${pre}-page \\.rx-hero-pad\\s*\\{\\s*padding-block:\\s*var\\(--px-44\\)`));
    expect(c).toMatch(new RegExp(`\\.${pre}-page \\.rx-hero-pad\\s*\\{\\s*padding-block:\\s*var\\(--px-52\\)`));
  });

  it('every hero section carries the shared hook', () => {
    for (const rel of ALL_HEROES) {
      const section = read(`src/sections/${rel}`).match(/<section[^>]*className="([^"]*)"/)?.[1] ?? '';
      expect(section, `${rel} is missing rx-hero-pad`).toContain('rx-hero-pad');
    }
  });
});

describe('hero subtitle outliers', () => {
  // These four had a bespoke size or none at all, and inherited their weight from the page root.
  const FIXED: Array<[string, string, string]> = [
    ['ab', 'about/about.css', 'ab-lead'],
    ['ci', 'catalogue-intelligence/catalogue-intelligence.css', 'ci-body-p'],
    ['mp', 'music-publishers/music-publishers.css', 'mp-body-p'],
    ['po', 'product/product.css', 'po-body-p'],
  ];

  it.each(FIXED)('%s matches the track-intelligence subtitle spec', (pre, file, cls) => {
    const c = live(css(file));
    const rule = c.match(new RegExp(`\\.${pre}-page \\.rx-hero-pad \\.${cls}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule).toMatch(/font-size:\s*var\(--px-17\)/);
    expect(rule).toMatch(/font-weight:\s*300/);
    expect(rule).toMatch(/line-height:\s*1\.65/);
  });

  it('is scoped to the hero, because these classes are reused down the page', () => {
    // .ci-body-p / .mp-body-p / .po-body-p appear 13-14 times per page; an unscoped rule would
    // have resized every body paragraph on those pages.
    for (const [pre, file, cls] of FIXED) {
      expect(live(css(file))).toContain(`.${pre}-page .rx-hero-pad .${cls}`);
    }
  });
});

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
