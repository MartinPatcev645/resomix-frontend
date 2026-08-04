import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Metric-matched fallback fonts — the fix for the CLS our own speed-up exposed.
 *
 * Mobile FCP went 10.7 s → 1.8 s, so the page now paints BEFORE the web fonts arrive. Text is drawn
 * in a system fallback and re-flows when the real font swaps in; PageSpeed measured CLS 0.191 mobile
 * and 0.675 desktop against a 0.1 threshold, naming `FiraCode-Light.latin.woff2` for 0.176 of the
 * mobile figure. The shift was always there — the old slowness hid it.
 *
 * Each family therefore has a fallback @font-face built from a LOCAL system font whose metrics are
 * stretched to match the web font exactly, so the swap changes glyph shapes but not one line box.
 *
 * These assertions guard the two silent failure modes: the generated file drifting out of the
 * stacks (so the fallback exists but nothing uses it), and an override going missing (so the
 * fallback is used but no longer matches).
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const fallbacks = read('src/styles/font-fallbacks.css');
const fonts = read('src/styles/fonts.css');

/** Comments explain the same properties they assert; strip them before matching. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '');

const FAMILIES = ['Helvetica_Neue Fallback', 'Fira Code Fallback', 'Benzin Fallback'];

describe('metric-matched fallback fonts', () => {
  it.each(FAMILIES)('declares %s with all four metric overrides', (family) => {
    const block = code(fallbacks).match(
      new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*\\}`),
    )?.[0];
    expect(block, `${family} has no @font-face`).toBeTruthy();

    // All four are needed: size-adjust alone matches width but not line height, so lines still move.
    expect(block).toMatch(/size-adjust:/);
    expect(block).toMatch(/ascent-override:/);
    expect(block).toMatch(/descent-override:/);
    expect(block).toMatch(/line-gap-override:/);
  });

  it.each(FAMILIES)('%s costs no bytes — local() only, never a url()', (family) => {
    const block = code(fallbacks).match(
      new RegExp(`@font-face\\s*\\{[^}]*font-family:\\s*'${family}'[^}]*\\}`),
    )![0];
    expect(block).toMatch(/src:\s*local\(/);
    // A downloaded fallback would defeat the point: it could not paint before the real font either.
    expect(block).not.toMatch(/url\(/);
  });

  it('produces plausible size-adjust values', () => {
    const values = [...code(fallbacks).matchAll(/size-adjust:\s*([\d.]+)%/g)].map((m) =>
      Number(m[1]),
    );
    expect(values).toHaveLength(FAMILIES.length);
    for (const v of values) {
      // Anything outside this range means the width measurement went wrong — which it did once,
      // when OS/2.xAvgCharWidth was compared across different table versions.
      expect(v, `size-adjust ${v}% is not a credible ratio`).toBeGreaterThan(50);
      expect(v).toBeLessThan(250);
    }
  });

  it('names each fallback in the utility class that uses the family', () => {
    const stacks = code(fonts);
    expect(stacks).toMatch(/\.font-helvetica\s*\{[^}]*'Helvetica_Neue Fallback'/);
    expect(stacks).toMatch(/\.font-fira\s*\{[^}]*'Fira Code Fallback'/);
    expect(stacks).toMatch(/\.font-benzin\s*\{[^}]*'Benzin Fallback'/);
  });

  it('puts the fallback after the real font, never before it', () => {
    const helvetica = code(fonts).match(/\.font-helvetica\s*\{[^}]*\}/)![0];
    expect(helvetica.indexOf("'Helvetica_Neue'")).toBeLessThan(
      helvetica.indexOf("'Helvetica_Neue Fallback'"),
    );
  });

  it('is imported, or none of it applies', () => {
    expect(read('src/index.css')).toContain('@import "./styles/font-fallbacks.css";');
  });
});
