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
  // The 11 headlines converted to marker-based emphasis. The other six carry it via their own
  // lead/em key pairs and are asserted separately below.
  const MARKED: Array<[string, string]> = [
    ['home.hero.title', 'Invisible'],
    ['developers.hero.title', 'One API.'],
    ['musicLibraries.hero.h1', 'sonic discovery engine'],
    ['recordLabels.hero.h1', 'Maximise'],
    ['syncAgencies.hero.h1', 'emotions'],
    ['partners.hero.title', 'Three ways'],
    ['partnersPilot.hero.title', 'your own catalogue.'],
    ['trust.hero.title', 'Clear boundaries.'],
    ['sonicDiscovery.hero.title', 'belongs next.'],
    ['trackIntelligence.hero.title', 'actually made of.'],
  ];

  it.each(MARKED)('%s emphasises %s', (key, phrase) => {
    const raw = at(key);
    const m = strip(raw).match(/\[\[(.+?)\]\]/);
    expect(m, `${key} lost its [[...]] marker`).not.toBeNull();
    expect(m![1]).toBe(phrase);
  });

  it('keeps exactly one accent phrase per headline', () => {
    for (const [key] of MARKED) {
      expect([...strip(at(key)).matchAll(/\[\[(.+?)\]\]/g)]).toHaveLength(1);
    }
  });

  it('the six lead/em heroes still split their headline', () => {
    const pairs = [
      ['about.hero.h1Lead', 'about.hero.h1Em'],
      ['catalogueIntelligence.hero.h1Lead', 'catalogueIntelligence.hero.h1Em'],
      ['musicPublishers.hero.h1Lead', 'musicPublishers.hero.h1Em'],
      ['product.hero.h1Lead', 'product.hero.h1Em'],
      ['musicCurators.hero.h1a', 'musicCurators.hero.h1b'],
      ['djs.hero.h1a', 'djs.hero.h1b'],
      ['producers.hero.h1a', 'producers.hero.h1b'],
    ];
    for (const [lead, em] of pairs) {
      expect(strip(at(lead)).length).toBeGreaterThan(0);
      expect(strip(at(em)).length).toBeGreaterThan(0);
    }
  });
});
