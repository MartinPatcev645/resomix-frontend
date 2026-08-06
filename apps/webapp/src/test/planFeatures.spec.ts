import { describe, it, expect } from 'vitest';
import { planFeatures, daysRemaining } from '@resomix/ui';
import type { BillingPlanLimits } from '@resomix/api-client';

/**
 * Pricing card copy and the founding countdown (pricing v2.1, E4).
 *
 * This is what a prospective customer reads *before* paying, so a number here that disagrees with
 * what they then get is the most expensive kind of wrong. Both pieces are pure functions precisely
 * so every line can be checked.
 *
 * The rules being pinned:
 *   * every number comes from `plan_entitlements` — the same rows that enforce it, so an admin
 *     raising a cap updates the page too. Hard-coded copy starts lying the first time a plan is
 *     edited, and nothing fails, which is why nobody notices;
 *   * `null` = unlimited and `0` = not included are OPPOSITES — neither may be treated as falsy;
 *   * "unlimited" always carries "(fair use)" (§6.2);
 *   * the countdown never claims the offer is open on its own; the server decides.
 */

const FREE: BillingPlanLimits = {
  searches_per_day: 3,
  uploads_per_month: 5,
  top_sk_max: 20,
  dropdown_max_tracks: 50,
  library_playlists_max: 5,
  exports_per_day: 1,
  export_track_limit: 20,
  can_view_full_analysis: false,
  can_similarity_upload: true,
};

const PRO: BillingPlanLimits = {
  searches_per_day: null,
  uploads_per_month: 50,
  top_sk_max: 100,
  dropdown_max_tracks: 100,
  library_playlists_max: null,
  exports_per_day: null,
  export_track_limit: 100,
  can_view_full_analysis: true,
  can_similarity_upload: true,
};

const GUEST: BillingPlanLimits = {
  ...FREE,
  uploads_per_month: 0,
  library_playlists_max: 0,
  exports_per_day: 0,
  top_sk_max: 10,
};

const text = (limits: BillingPlanLimits) => planFeatures(limits).map((f) => f.text).join(' | ');
const find = (limits: BillingPlanLimits, key: string) =>
  planFeatures(limits).find((f) => f.key === key);

describe('free plan card', () => {
  it('quotes the daily search allowance', () => {
    expect(find(FREE, 'searches')?.text).toBe('3 sonic searches a day');
  });

  it('quotes what is UNLOCKED, not what is selectable', () => {
    // A free user may select 50 but sees 20 unlocked. Quoting the dropdown number would promise
    // 50 matches to someone who gets 20 — the single most misleading number available here.
    expect(find(FREE, 'depth')?.text).toBe('Top 20 matches per search');
    expect(text(FREE)).not.toContain('50');
  });

  it('quotes uploads monthly', () => {
    expect(find(FREE, 'uploads')?.text).toBe('5 track uploads a month');
  });

  it('describes the Library as a listing, never a deletion', () => {
    // The cap governs what is LISTED. "5 playlists maximum" would imply the sixth is refused.
    expect(find(FREE, 'library')?.text).toBe('5 playlists in your Library');
  });

  it('describes the free analysis boundary', () => {
    expect(find(FREE, 'analysis')?.text).toContain('summary');
    expect(find(FREE, 'analysis')?.text).not.toContain('Full Track Intelligence');
  });
});

describe('pro plan card', () => {
  it('writes unlimited with the fair-use qualifier', () => {
    // A hard UI-text rule (§6.2).
    expect(find(PRO, 'searches')?.text).toBe('Unlimited (fair use) sonic searches');
  });

  it('never prints the -1 sentinel', () => {
    expect(text(PRO)).not.toContain('-1');
  });

  it('says every playlist is kept, without a number', () => {
    expect(find(PRO, 'library')?.text).toBe('Every playlist kept in your Library');
  });

  it('offers full Track Intelligence', () => {
    expect(find(PRO, 'analysis')?.text).toBe('Full Track Intelligence');
  });

  it('still quotes the monthly upload cap, which is NOT unlimited', () => {
    // Pro is 50/month. Reading "unlimited searches" and inferring unlimited everything is the
    // mistake this line prevents.
    expect(find(PRO, 'uploads')?.text).toBe('50 track uploads a month');
  });
});

describe('zero is not unlimited', () => {
  it('marks an excluded capability as not included', () => {
    // `0` and `null` are opposites. A falsy check would render "not included" as "unlimited" —
    // advertising a guest as having unlimited uploads.
    expect(find(GUEST, 'uploads')?.included).toBe(false);
    expect(find(GUEST, 'exports')?.included).toBe(false);
  });

  it('names the excluded capability without a number', () => {
    expect(find(GUEST, 'uploads')?.text).toBe('Track uploads');
  });

  it('keeps included capabilities marked included', () => {
    expect(find(FREE, 'uploads')?.included).toBe(true);
    expect(find(PRO, 'searches')?.included).toBe(true);
  });
});

describe('pluralisation', () => {
  it('uses the singular for one', () => {
    expect(find(FREE, 'exports')?.text).toBe('1 export a day');
  });

  it('uses the plural for many', () => {
    expect(find({ ...FREE, exports_per_day: 4 }, 'exports')?.text).toBe('4 exports a day');
  });

  it('handles a single search', () => {
    expect(find({ ...FREE, searches_per_day: 1 }, 'searches')?.text).toBe('1 sonic search a day');
  });

  it('handles a single library slot', () => {
    expect(find({ ...FREE, library_playlists_max: 1 }, 'library')?.text).toBe('1 playlist in your Library');
  });
});

describe('missing data', () => {
  it('renders nothing rather than guessing', () => {
    // An older server sends no limits. An empty list is honest; invented defaults would be a
    // price list for a product we are not selling.
    expect(planFeatures(undefined)).toEqual([]);
    expect(planFeatures(null)).toEqual([]);
  });
});

describe('founding countdown', () => {
  const now = new Date('2026-08-06T00:00:00Z');

  it('counts whole days to the deadline', () => {
    expect(daysRemaining('2026-08-16T00:00:00Z', now)).toBe(10);
  });

  it('rounds a part-day up, so the last day still reads as one', () => {
    // Flooring would show "0 days left" for most of the final day.
    expect(daysRemaining('2026-08-06T18:00:00Z', now)).toBe(1);
  });

  it('returns null once the deadline has passed', () => {
    expect(daysRemaining('2026-08-05T00:00:00Z', now)).toBeNull();
  });

  it('returns null at the exact deadline', () => {
    expect(daysRemaining('2026-08-06T00:00:00Z', now)).toBeNull();
  });

  it('returns null with no date', () => {
    expect(daysRemaining(null, now)).toBeNull();
    expect(daysRemaining(undefined, now)).toBeNull();
  });

  it('returns null for an unparseable date', () => {
    // A malformed env value must not render "NaN days left" on the pricing page.
    expect(daysRemaining('not-a-date', now)).toBeNull();
  });

  it('counts to the real configured deadline', () => {
    // 2027-02-01T00:00:00Z — George's date, resolved in UTC.
    expect(daysRemaining('2027-02-01T00:00:00Z', now)).toBe(179);
  });
});
