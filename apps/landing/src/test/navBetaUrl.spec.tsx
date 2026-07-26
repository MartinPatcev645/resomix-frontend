import { describe, it, expect, vi, beforeEach } from 'vitest';

const FALLBACK = 'https://beta.resomix.com';

describe('BETA_URL guard', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is never empty when BASE_BETA_URL is unset', async () => {
    vi.doMock('@resomix/config', () => ({
      BASE_BETA_URL: '',
      BASE_LANDING_URL: '',
    }));
    const { BETA_URL } = await import('../components/Navigation/navData.ts');
    expect(BETA_URL).toBe(FALLBACK);
    expect(BETA_URL.length).toBeGreaterThan(0);
  });

  it('uses env value when BASE_BETA_URL is set', async () => {
    vi.doMock('@resomix/config', () => ({
      BASE_BETA_URL: FALLBACK,
      BASE_LANDING_URL: '',
    }));
    const { BETA_URL } = await import('../components/Navigation/navData.ts');
    expect(BETA_URL).toBe(FALLBACK);
    expect(BETA_URL.length).toBeGreaterThan(0);
  });
});
