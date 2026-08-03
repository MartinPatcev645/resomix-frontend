import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PartnerPricingContent } from '@resomix/ui';

/**
 * /subscribe was still on the older visual language — 10px radii, `backdrop-blur-md`, rounded-full
 * pill toggles, dotted slate borders, centred headers — while every marketing page had moved to
 * square hairline panels, mono eyebrows and the Benzin headline ramp. It read as a different site.
 *
 * The billing behaviour is deliberately untouched, so these cover the presentation contract plus
 * the fact that the section still renders its plans and CTAs.
 */

const readUi = (p: string) =>
  readFileSync(resolve(process.cwd(), `../../packages/ui/src/Billing/${p}`), 'utf8');

/**
 * Code only. The comments in these files name the old treatment on purpose — explaining why it was
 * replaced — so asserting against raw text would flag the explanation as the thing it describes.
 */
const ui = (p: string) =>
  readUi(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const PAGE_FILES = [
  'PricingContent.tsx',
  'ConsumerPricingContent.tsx',
  'PartnerPricingContent.tsx',
  'PricingChrome.tsx',
  'PricingButton.tsx',
];

describe('pricing page adopts the marketing system', () => {
  it('uses the canonical hero ramp for the page headline', () => {
    const src = ui('PricingContent.tsx');
    expect(src).toContain('font-benzin');
    expect(src).toContain('font-black');
    expect(src).toContain('text-[length:var(--px-32)]');
    expect(src).toContain('md:text-[length:var(--px-36)]');
    expect(src).toContain('lg:text-[length:var(--px-48)]');
  });

  it('accents part of the headline, like every other hero', () => {
    expect(ui('PricingContent.tsx')).toContain('text-[var(--color-neon-orange)]');
  });

  it('uses the shared 44/52 block padding', () => {
    const src = ui('PricingContent.tsx');
    expect(src).toContain('py-[var(--px-44)]');
    expect(src).toContain('lg:py-[var(--px-52)]');
  });

  it.each(PAGE_FILES)('%s drops the old rounded/blurred treatment', (file) => {
    const src = ui(file);
    // The tells of the previous design.
    expect(src, 'backdrop blur').not.toContain('backdrop-blur');
    expect(src, 'pill shapes').not.toContain('rounded-full');
    expect(src, 'dotted slate edges').not.toContain('border-dotted');
    expect(src, 'slate palette').not.toContain('slate-200');
    expect(src, '10px radius').not.toContain('rounded-[var(--px-10)]');
  });

  it('no longer pulls in ButtonSleek', () => {
    // Still correct for the webapp's modals — restyling it there would have been collateral damage,
    // so the marketing button is reproduced locally instead.
    for (const f of PAGE_FILES) expect(ui(f)).not.toContain('ButtonSleek');
  });
});

describe('marketing button spec', () => {
  it('the filled primary carries the corner notch and accent fill', () => {
    const src = ui('PricingButton.tsx');
    expect(src).toContain('clipPath');
    expect(src).toContain('calc(100% - 10px)');
    expect(src).toContain('bg-[var(--color-neon-orange)]');
    // Near-black label on the fill; hover lifts the fill, not the label.
    expect(src).toContain('text-[#101010]');
    expect(src).toContain('hover:bg-[#f2603f]');
  });

  it('matches the marketing type spec', () => {
    const src = ui('PricingButton.tsx');
    expect(src).toContain('font-fira');
    expect(src).toContain('text-[length:var(--px-12)]');
    expect(src).toContain('tracking-[0.09em]');
    expect(src).toContain('min-h-[var(--px-44)]');
  });
});

describe('partner section still works', () => {
  const renderPartner = () => render(<PartnerPricingContent partnersUrl="https://example.test/partners" />);

  it('renders all three tiers', () => {
    renderPartner();
    for (const name of ['Starter', 'Growth', 'Enterprise']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
  });

  it('keeps the annual/monthly toggle working', () => {
    renderPartner();
    // Annual is the default and drives the discounted price.
    expect(screen.getByText('82.50')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^monthly$/i }));
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('exposes the toggle state to assistive tech', () => {
    renderPartner();
    expect(screen.getByRole('button', { name: /annually/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /monthly/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends every plan CTA to the partners form', () => {
    const href = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { set href(v: string) { href(v); } } });
    renderPartner();
    fireEvent.click(screen.getByRole('button', { name: /get starter key/i }));
    expect(href).toHaveBeenCalledWith('https://example.test/partners');
  });
});
