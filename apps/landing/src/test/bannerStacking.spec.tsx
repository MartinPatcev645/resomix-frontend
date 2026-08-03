import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AuthStatusBanner, DemoStageBanner } from '@resomix/ui';

/**
 * The beta notice rendered grey on most marketing pages and was invisible on the darkest ones
 * (/product/sonic-discovery, /partners/pilot), while looking correct on /about.
 *
 * Cause was stacking, not colour. Both banners are rendered by OptionalAuthRoute *outside* the page
 * shell, and that shell is `relative z-30` — a stacking context. The marketing pages hang their
 * void-field backdrop (`position: fixed; inset: 0`) inside it; those layers set a negative z-index,
 * which only puts them at the bottom OF THAT CONTEXT. The context itself still paints at 30, so a
 * full-viewport translucent plate landed on top of a z-10 banner. /about was clean only because it
 * uses the shared AppBackground, which LandingLayout renders outside the shell.
 *
 * So the invariant is a relationship between two files, and that is what is asserted here: a colour
 * assertion would have passed throughout the bug.
 */

// vitest runs with cwd at the app root; import.meta.url is not a file: URL under jsdom.
const layoutSource = readFileSync(
  resolve(process.cwd(), 'src/components/Layout/LandingLayout.tsx'),
  'utf8',
);

/** z-index of the page shell — the wrapper every route's backdrop is nested inside. */
const shellZ = (() => {
  const line = layoutSource.split('\n').find((l) => l.includes('mx-auto') && l.includes('z-'));
  const m = line?.match(/\bz-(\d+)\b/);
  if (!m) throw new Error('page shell z-index not found in LandingLayout — update this test');
  return Number(m[1]);
})();

/** Lowest z-index of anything that is *supposed* to cover the banner (mobile drawer, navigation.css). */
const DRAWER_Z = 70;

const rootOf = (html: HTMLElement) => html.firstElementChild as HTMLElement;

const banners = [
  ['DemoStageBanner', () => render(<DemoStageBanner onDismiss={vi.fn()} />)] as const,
  [
    'AuthStatusBanner',
    () => render(<AuthStatusBanner onResendVerification={vi.fn()} onDismiss={vi.fn()} />),
  ] as const,
];

describe.each(banners)('%s stacking', (_name, renderBanner) => {
  const classes = () => rootOf(renderBanner().container).className;

  it('is positioned, so its z-index is not inert', () => {
    // AuthStatusBanner carried `z-10` on a statically positioned box: z-index does nothing there,
    // so it was never merely too low — it was ignored outright.
    expect(classes()).toMatch(/\b(relative|absolute|fixed|sticky)\b/);
  });

  it('paints above the page shell, not under its backdrop', () => {
    const z = Number(classes().match(/\bz-(\d+)\b/)?.[1]);
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBeGreaterThan(shellZ);
  });

  it('still sits below the drawer and modals that must cover it', () => {
    const z = Number(classes().match(/\bz-(\d+)\b/)?.[1]);
    expect(z).toBeLessThan(DRAWER_Z);
  });
});

describe('page shell assumption', () => {
  it('reads a real z-index off the shell', () => {
    // Guards the test itself: if the wrapper is refactored away, fail loudly rather than
    // silently comparing against a default.
    expect(shellZ).toBeGreaterThan(0);
  });
});
