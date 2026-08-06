import { describe, it, expect } from 'vitest';
import { quotaDenialCopy } from '@resomix/hooks';
import type { QuotaDenial } from '@resomix/api-client';

/**
 * What a 402 says to the user (pricing v2.1, E2).
 *
 * This is the text someone reads at the exact moment we refuse them something, so the bar is not
 * "does it render" — it is "is every sentence true for this account". A pure resolver, so every
 * branch can be checked.
 *
 * The rules being pinned:
 *   * numbers come from the DENIAL, never from cached entitlements — the server resolved the plan
 *     when it decided to refuse, and quoting a stale 3 while refusing the 4th is the one thing this
 *     modal must never do;
 *   * a spent allowance says when it comes back; a missing capability must NOT, because waiting
 *     will not help;
 *   * house UI-text rules: no "AI", no competitor names, no accuracy percentages, and "unlimited"
 *     always carries "(fair use)";
 *   * an unrecognised code shows nothing rather than a guess.
 */

const denial = (over: Partial<QuotaDenial> = {}): QuotaDenial => ({
  code: 'quota_exceeded',
  error: 'server sentence',
  reason: 'upgrade_required',
  quota: { metric: 'search_playlists_per_month', used: 3, limit: 3, upgrade: 'pro' },
  ...over,
});

describe('search quota', () => {
  it('quotes the limit from the denial, not from cached entitlements', () => {
    // Quoting a cached 3 while refusing the 4th is the failure this exists to prevent.
    const copy = quotaDenialCopy(denial({ quota: { metric: 'search_playlists_per_month', limit: 3 } }));
    expect(copy?.body).toContain('3 free sonic searches');
  });

  it('says the allowance is daily', () => {
    expect(quotaDenialCopy(denial())?.body).toContain("today's");
  });

  it('never says month', () => {
    // The window moved to daily while the feature KEY kept its "per_month" name (Q3). Copy that
    // followed the key would tell someone to wait a month for tomorrow.
    expect(quotaDenialCopy(denial())?.body.toLowerCase()).not.toContain('month');
  });

  it('writes unlimited with the fair-use qualifier', () => {
    // A hard UI-text rule (§6.2).
    const body = quotaDenialCopy(denial())?.body ?? '';
    expect(body).toContain('unlimited (fair use)');
  });

  it('uses the singular when the limit is one', () => {
    const copy = quotaDenialCopy(denial({ quota: { metric: 'search_playlists_per_month', limit: 1 } }));
    expect(copy?.body).toContain('1 free sonic search.');
  });

  it('still reads correctly when the limit is missing', () => {
    // A denial without numbers is possible (an older server, a partial payload). The sentence has
    // to survive it rather than printing "undefined".
    const copy = quotaDenialCopy(denial({ quota: null }));
    expect(copy?.body).toContain('free sonic searches');
    expect(copy?.body).not.toContain('undefined');
  });

  it('offers an upgrade, not a login', () => {
    expect(quotaDenialCopy(denial())?.reason).toBe('upgrade_required');
  });
});

describe('upload quota', () => {
  const uploads = denial({ quota: { metric: 'uploads_per_month', used: 5, limit: 5 } });

  it('is monthly', () => {
    // Uploads did NOT re-window — Stripe owns that anchor.
    expect(quotaDenialCopy(uploads)?.body).toContain('this month');
  });

  it('quotes the upload limit', () => {
    expect(quotaDenialCopy(uploads)?.body).toContain('5 uploads');
  });

  it('reassures that existing work is untouched', () => {
    // The cap governs creation, never deletion — saying so prevents "have I lost my analyses?".
    expect(quotaDenialCopy(uploads)?.body.toLowerCase()).toContain('stay');
  });

  it('has its own title, not the search one', () => {
    expect(quotaDenialCopy(uploads)?.title).not.toBe(quotaDenialCopy(denial())?.title);
  });
});

describe('library full', () => {
  const full = denial({ code: 'library_full', quota: { metric: 'library_playlists_max', limit: 5 } });

  it('quotes the cap', () => {
    expect(quotaDenialCopy(full)?.body).toContain('5 playlists');
  });

  it('says the playlist still exists', () => {
    // The cap governs the LISTING only. Without this the user reasonably concludes their playlist
    // was refused or deleted.
    const body = quotaDenialCopy(full)?.body ?? '';
    expect(body).toContain('still saved');
    expect(body).toContain('link');
  });

  it('does not promise a reset', () => {
    // The Library cap is not a window — deleting a playlist frees a slot immediately.
    const body = quotaDenialCopy(full)?.body.toLowerCase() ?? '';
    expect(body).not.toContain('tomorrow');
    expect(body).not.toContain('resets');
  });
});

describe('export limit', () => {
  it('is reached by its own code', () => {
    const copy = quotaDenialCopy(denial({ code: 'export_limit_reached', quota: null }));
    expect(copy?.body).toContain("today's export");
  });

  it('is also reached via the exports metric on a generic quota code', () => {
    // The transfer endpoints deny through `exports_per_day`; both routes must land on the same
    // sentence, or the same refusal reads differently depending on which button was pressed.
    const copy = quotaDenialCopy(denial({ quota: { metric: 'exports_per_day', limit: 1 } }));
    expect(copy?.body).toContain("today's export");
  });
});

describe('plan_required — a capability the plan lacks', () => {
  it('never promises a reset', () => {
    // Waiting cannot help. "Try again tomorrow" here would be a lie that costs a support ticket.
    const copy = quotaDenialCopy(
      denial({ code: 'plan_required', error: 'Full Track Intelligence is a Pro feature.', quota: null }),
    );
    const body = copy?.body.toLowerCase() ?? '';
    expect(body).not.toContain('tomorrow');
    expect(body).not.toContain('today');
  });

  it('leads with what the reader still has, for full analysis', () => {
    const copy = quotaDenialCopy(
      denial({ code: 'plan_required', error: 'Full Track Intelligence is a Pro feature.', quota: null }),
    );
    expect(copy?.body).toContain('stays free');
  });

  it('recognises the embed case', () => {
    const copy = quotaDenialCopy(
      denial({ code: 'plan_required', error: 'Embed sharing is not available on your plan.', quota: null }),
    );
    expect(copy?.title.toLowerCase()).toContain('embed');
  });

  it('falls back to the server sentence for an unknown capability', () => {
    // Only the server knows WHICH capability this was; inventing a name would be worse than
    // repeating what it said.
    const copy = quotaDenialCopy(
      denial({ code: 'plan_required', error: 'Serato export is not available on your plan.', quota: null }),
    );
    expect(copy?.body).toContain('Serato');
  });
});

describe('login_required', () => {
  const guest = denial({
    code: 'login_required',
    reason: 'login_required',
    error: 'Create a free account to export this playlist.',
    quota: null,
  });

  it('offers a signup, not an upgrade', () => {
    // A guest cannot upgrade anything — they have no account to upgrade.
    expect(quotaDenialCopy(guest)?.reason).toBe('login_required');
  });

  it('uses the server sentence, which names the action', () => {
    expect(quotaDenialCopy(guest)?.body).toContain('export this playlist');
  });
});

describe('unknown denials', () => {
  it('shows nothing for an unrecognised code with no reason', () => {
    // A modal built from a code we do not understand states something wrong with confidence. The
    // call site still surfaces the server's own message, so silence leaves the user informed.
    expect(quotaDenialCopy(denial({ code: 'something_new', reason: null }))).toBeNull();
  });

  it('falls back to the older reason contract when present', () => {
    const copy = quotaDenialCopy(
      denial({ code: null, reason: 'upgrade_required', error: 'Some new limit.' }),
    );
    expect(copy?.body).toBe('Some new limit.');
  });

  it('returns null for no denial at all', () => {
    expect(quotaDenialCopy(null)).toBeNull();
  });
});

describe('house UI-text rules', () => {
  const everyCopy = [
    denial(),
    denial({ quota: { metric: 'uploads_per_month', limit: 5 } }),
    denial({ code: 'library_full', quota: { metric: 'library_playlists_max', limit: 5 } }),
    denial({ code: 'export_limit_reached', quota: null }),
    denial({ code: 'plan_required', error: 'Full Track Intelligence is a Pro feature.', quota: null }),
  ].map((d) => quotaDenialCopy(d));

  it.each([
    ['AI', /\bAI\b/],
    ['a competitor name', /spotify|apple music|beatport|rekordbox/i],
    ['an accuracy percentage', /\d+\s?% (accurate|accuracy)/i],
    ['an uptime or SLA claim', /uptime|sla|guaranteed/i],
  ])('never mentions %s', (_label, pattern) => {
    for (const copy of everyCopy) {
      expect(`${copy?.title} ${copy?.body}`).not.toMatch(pattern);
    }
  });

  it('always pairs "unlimited" with "(fair use)"', () => {
    for (const copy of everyCopy) {
      const text = `${copy?.title} ${copy?.body}`;
      if (/unlimited/i.test(text)) expect(text).toMatch(/unlimited \(fair use\)/i);
    }
  });

  it('never quotes a price', () => {
    // §6.2's example copy quotes €7.99. A price baked into a modal goes stale silently and is
    // wrong in every currency but one; the CTA routes to the pricing page instead.
    for (const copy of everyCopy) {
      expect(`${copy?.title} ${copy?.body}`).not.toMatch(/[€$£]\s?\d/);
    }
  });

  it('gives every copy a title and a body', () => {
    for (const copy of everyCopy) {
      expect(copy?.title?.length).toBeGreaterThan(0);
      expect(copy?.body?.length).toBeGreaterThan(0);
    }
  });
});
