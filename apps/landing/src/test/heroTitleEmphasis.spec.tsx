import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HeroTitle } from '@/components/HeroTitle.tsx';

/**
 * Hero headlines accent one phrase, marked in the translation string with [[double brackets]].
 * Previously only 6 of the 17 heroes coloured anything, and /about used an underline instead of a
 * colour, so the treatment read as accidental rather than deliberate.
 *
 * The parser is covered directly, and the locale file is checked so a copy edit cannot quietly drop
 * a marker and silently un-emphasise a page — nothing would throw, the colour would just vanish.
 */

const strip = (s: string) => s.replace(/­/g, '');

const locale = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/locales/en/common.json'), 'utf8'),
);

const at = (path: string) =>
  path.split('.').reduce<Record<string, unknown> | string>((o, k) => (o as never)[k], locale) as string;

describe('HeroTitle marker parsing', () => {
  it('accents the marked phrase and leaves the rest alone', () => {
    const { container } = render(<HeroTitle text="Hear the [[Invisible]]" emClass="hm-em" />);
    const em = container.querySelector('.hm-em');
    expect(em).toHaveTextContent('Invisible');
    expect(container.textContent).toBe('Hear the Invisible');
  });

  it('handles emphasis at the start, with text after it', () => {
    const { container } = render(<HeroTitle text="[[One API.]] Search and analysis." emClass="dev-em" />);
    expect(container.querySelector('.dev-em')).toHaveTextContent('One API.');
    expect(container.textContent).toBe('One API. Search and analysis.');
  });

  it('turns \\n into a line break', () => {
    const { container } = render(<HeroTitle text={'Drop one track.\nFind what [[belongs next.]]'} emClass="sd-em" />);
    expect(container.querySelectorAll('br')).toHaveLength(1);
    expect(container.querySelector('.sd-em')).toHaveTextContent('belongs next.');
  });

  it('renders an unmarked headline unchanged', () => {
    const { container } = render(<HeroTitle text="No emphasis here" emClass="x-em" />);
    expect(container.textContent).toBe('No emphasis here');
    expect(container.querySelector('.x-em')).toBeNull();
  });

  it('never leaks the markers into the rendered text', () => {
    const { container } = render(<HeroTitle text="a [[b]] c" emClass="x-em" />);
    expect(container.textContent).not.toMatch(/[[\]]{2}/);
  });
});

describe('every hero headline marks an accent phrase', () => {
  /**
   * All 17 heroes, keyed by the locale entry that holds the headline.
   *
   * Deliberately asserts the CONTRACT (exactly one `[[…]]` per headline) rather than the specific
   * words. Copy comes from docs/SEO_METADATA_ALL_PAGES.md and changes on its own schedule;
   * duplicating the wording here would mean every copy edit breaks a test for no safety gain. What
   * must not silently break is the marker itself — drop it and the accent just vanishes.
   */
  const HERO_KEYS = [
    'home.hero.title',
    'about.hero.title',
    'product.hero.title',
    'sonicDiscovery.hero.title',
    'trackIntelligence.hero.title',
    'catalogueIntelligence.hero.title',
    'developers.hero.title',
    'partners.hero.title',
    'partnersPilot.hero.title',
    'trust.hero.title',
    'recordLabels.hero.h1',
    'musicPublishers.hero.title',
    'syncAgencies.hero.h1',
    'musicLibraries.hero.h1',
    'djs.hero.title',
    'musicCurators.hero.title',
    'producers.hero.title',
  ];

  it.each(HERO_KEYS)('%s marks exactly one accent phrase', (key) => {
    const markers = [...strip(at(key)).matchAll(/\[\[(.+?)\]\]/g)];
    expect(markers, `${key} lost its [[…]] marker`).toHaveLength(1);
    expect(markers[0][1].trim().length).toBeGreaterThan(0);
  });

  it('covers every hero on the site', () => {
    expect(HERO_KEYS).toHaveLength(17);
  });

  it('has retired the old lead/em key pairs', () => {
    // Seven heroes used to split the headline across two keys, which pinned the accent to a fixed
    // position. All 17 now use the inline marker, so moving it is a copy edit.
    const dead = [
      'about.hero.h1Lead', 'product.hero.h1Lead', 'catalogueIntelligence.hero.h1Lead',
      'musicPublishers.hero.h1Lead', 'djs.hero.h1a', 'musicCurators.hero.h1a',
      'producers.hero.h1a', 'trackIntelligence.hero.titleLine1',
    ];
    for (const key of dead) {
      const val = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], locale);
      expect(val, `${key} is still in the locale`).toBeUndefined();
    }
  });
});
