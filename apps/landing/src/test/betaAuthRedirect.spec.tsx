import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach, afterAll } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BetaAuthRedirect } from '../components/BetaAuthRedirect.tsx';
import { BASE_BETA_URL } from '@resomix/config';

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return { ...actual, useSilktide: () => ({ loaded: false }) };
});

const replace = vi.fn();
const originalLocation = window.location;

beforeEach(() => {
  replace.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, replace, assign: vi.fn(), href: 'https://resomix.com/' },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

/** Render the redirect at a marketing-site URL and return where it sent the browser. */
async function redirectFrom(url: string): Promise<string> {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/auth/*" element={<BetaAuthRedirect />} />
        <Route path="/profile" element={<BetaAuthRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
  return replace.mock.calls[0][0] as string;
}

const beta = BASE_BETA_URL.replace(/\/$/, '');

describe('BetaAuthRedirect', () => {
  it.each([
    ['/auth/login', `${beta}/auth/login`],
    ['/auth/register', `${beta}/auth/register`],
    ['/auth/forgot-password', `${beta}/auth/forgot-password`],
    ['/auth/verify-2fa', `${beta}/auth/verify-2fa`],
    ['/profile', `${beta}/profile`],
  ])('forwards %s to the same path on beta', async (from, expected) => {
    expect(await redirectFrom(from)).toBe(expected);
  });

  /**
   * The one that must not regress. The backend builds verify/reset emails from FRONTEND_URL,
   * which is the marketing host — so links already in inboxes carry their token on a resomix.com
   * URL. Dropping the query here would make those accounts unverifiable.
   */
  it.each([
    ['/auth/reset-password?token=abc123', `${beta}/auth/reset-password?token=abc123`],
    ['/auth/verify-email?token=xyz789', `${beta}/auth/verify-email?token=xyz789`],
  ])('carries the token across: %s', async (from, expected) => {
    expect(await redirectFrom(from)).toBe(expected);
  });

  it('preserves every query param and the hash, not just the first', async () => {
    expect(await redirectFrom('/auth/login?redirect=%2F&foo=bar#frag')).toBe(
      `${beta}/auth/login?redirect=%2F&foo=bar#frag`,
    );
  });

  it('uses replace so the marketing URL leaves no history entry to bounce back into', async () => {
    await redirectFrom('/auth/login');
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('forwards unknown auth paths too, rather than 404ing on the marketing site', async () => {
    expect(await redirectFrom('/auth/some-future-flow?x=1')).toBe(`${beta}/auth/some-future-flow?x=1`);
  });
});
