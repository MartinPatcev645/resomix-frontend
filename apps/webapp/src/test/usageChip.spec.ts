import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Usage chip — what it says, and when it says nothing (pricing v2.1, E1).
 *
 * `⌕ 2/3 today · ↑ 4/5 this month`
 *
 * The chip states a fact about someone's account in their own header, so every failure mode here is
 * "we told the user something untrue":
 *
 *   * `null` from the server means "unlimited" (limits) or "could not read" (usage). Rendering
 *     either as `0` claims a spent allowance to someone who has their whole one.
 *   * A guest's `0` limit is a login wall, not a quota — "0/0 today" describes an invitation as a
 *     failure.
 *   * Half a fraction ("2/" or a lone "3") reads as either a bug or a limit, depending on which
 *     half survived.
 *
 * So the rule is: show a metric only when both halves are real numbers and the limit is a real
 * ceiling. Otherwise show nothing at all — a chip that guesses is worse than no chip.
 */

// Mocked at the API boundary rather than at `useEntitlements`, so the real hook chain runs:
// fetch → cache → `useUsageChip`. Mocking the hook would have tested the fixture instead, and
// would not have noticed if the two stopped agreeing about the response shape.
const getMyEntitlements = vi.fn();

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return { ...actual, getMyEntitlements: () => getMyEntitlements() };
});

const { useUsageChip, resetEntitlementsCache } = await import('@resomix/hooks');

const FREE_LIMITS = {
  searches_per_day: 3,
  uploads_per_month: 5,
  top_sk_max: 20,
  dropdown_max_tracks: 50,
  library_playlists_max: 5,
  exports_per_day: 1,
  export_track_limit: 20,
};

const FREE_USAGE = {
  searches_used_today: 2,
  uploads_used_month: 4,
  exports_used_today: 0,
  library_playlists_used: 3,
};

const RESETS = {
  search_at: '2026-08-07T00:00:00+00:00',
  upload_at: '2026-08-20T09:00:00+00:00',
  export_at: '2026-08-07T00:00:00+00:00',
};

type ChipResult = ReturnType<typeof useUsageChip>;

/** Render the chip against a server response. `pending: true` leaves the fetch unresolved. */
async function given(
  overrides: Record<string, unknown> = {},
  { pending = false } = {},
): Promise<ChipResult> {
  if (pending) {
    getMyEntitlements.mockReturnValue(new Promise(() => {}));
  } else {
    getMyEntitlements.mockResolvedValue({
      success: true,
      data: {
        is_frontend: true,
        is_guest: false,
        plan: { code: 'free', name: 'Free', is_default: true },
        entitlements: {},
        limits: FREE_LIMITS,
        usage: FREE_USAGE,
        resets: RESETS,
        ...overrides,
      },
    });
  }

  const { result } = renderHook(() => useUsageChip());
  if (!pending) await waitFor(() => expect(getMyEntitlements).toHaveBeenCalled());
  await waitFor(() => expect(result.current).toBeDefined());
  return result.current;
}

const metric = (result: ChipResult, key: string) => result.metrics.find((m) => m.key === key);

beforeEach(() => {
  getMyEntitlements.mockReset();
  // The hook shares a module-level cache across consumers; without this, test 2 would render
  // test 1's response.
  resetEntitlementsCache();
});

describe('usage chip — a free account', () => {
  it('shows the searches fraction', async () => {
    const searches = metric(await given(), 'searches');
    expect(searches?.used).toBe(2);
    expect(searches?.limit).toBe(3);
    expect(searches?.period).toBe('today');
  });

  it('shows the uploads fraction with a monthly period', async () => {
    const uploads = metric(await given(), 'uploads');
    expect(uploads?.used).toBe(4);
    expect(uploads?.limit).toBe(5);
    expect(uploads?.period).toBe('this month');
  });

  it('shows zero usage as a real value', async () => {
    // 0 is the most common usage value; a truthiness check would drop the metric entirely.
    expect(metric(await given(), 'exports')?.used).toBe(0);
  });

  it('gives the Library no period wording', async () => {
    // Deleting a playlist frees a slot immediately — the cap is not a window, so "today" or
    // "this month" would both be wrong.
    expect(metric(await given(), 'library')?.period).toBe('');
  });

  it('is visible', async () => {
    expect((await given()).hidden).toBe(false);
  });
});

describe('spent allowances', () => {
  it('marks a metric spent at the limit', async () => {
    const result = await given({ usage: { ...FREE_USAGE, searches_used_today: 3 } });
    expect(metric(result, 'searches')?.spent).toBe(true);
  });

  it('marks a metric spent past the limit', async () => {
    // Reachable after a downgrade, or an admin lowering a plan mid-period.
    const result = await given({ usage: { ...FREE_USAGE, searches_used_today: 9 } });
    expect(metric(result, 'searches')?.spent).toBe(true);
  });

  it('does not mark an unspent metric', async () => {
    expect(metric(await given(), 'searches')?.spent).toBe(false);
  });
});

describe('unlimited is hidden, not rendered as a number', () => {
  it('drops a metric whose limit is null', async () => {
    // Usage IS tracked for Pro — it is what the fair-use position rests on — but a counter with no
    // denominator is not something a user can act on.
    const result = await given({ limits: { ...FREE_LIMITS, searches_per_day: null } });
    expect(metric(result, 'searches')).toBeUndefined();
  });

  it('keeps the other metrics', async () => {
    const result = await given({ limits: { ...FREE_LIMITS, searches_per_day: null } });
    expect(metric(result, 'uploads')).toBeDefined();
  });

  it('hides the whole chip when every limit is unlimited', async () => {
    const result = await given({
      limits: {
        ...FREE_LIMITS,
        searches_per_day: null,
        uploads_per_month: null,
        exports_per_day: null,
        library_playlists_max: null,
      },
    });
    expect(result.hidden).toBe(true);
    expect(result.metrics).toHaveLength(0);
  });
});

describe('unknown values are never rendered as zero', () => {
  it('drops a metric whose usage could not be read', async () => {
    // Redis down. "0/3" would tell someone who has spent all three that they have three left.
    const result = await given({ usage: { ...FREE_USAGE, searches_used_today: null } });
    expect(metric(result, 'searches')).toBeUndefined();
  });

  it('hides the chip entirely when nothing could be read', async () => {
    const result = await given({
      usage: {
        searches_used_today: null,
        uploads_used_month: null,
        exports_used_today: null,
        library_playlists_used: null,
      },
    });
    expect(result.hidden).toBe(true);
  });

  it('hides while entitlements are still loading', async () => {
    // A chip that appears with wrong numbers and then corrects itself is worse than one that
    // appears once, correct.
    expect((await given({}, { pending: true })).hidden).toBe(true);
  });

  it('hides when the server sent no usage block at all', async () => {
    // An older backend, or a B2B caller — the endpoint returns neither block.
    expect((await given({ limits: undefined, usage: undefined })).hidden).toBe(true);
  });
});

describe('a zero limit is a login wall, not a quota', () => {
  it('drops a metric whose limit is zero', async () => {
    // Guests have `exports_per_day: 0`. "0/0 today" describes an invitation to sign up as a
    // failure state.
    const result = await given({
      limits: { ...FREE_LIMITS, exports_per_day: 0 },
      usage: { ...FREE_USAGE, exports_used_today: 0 },
    });
    expect(metric(result, 'exports')).toBeUndefined();
  });
});

describe('a 402 refreshes the numbers', () => {
  it('re-fetches when the server refuses on a limit', async () => {
    // Without this the chip keeps reading "2/3" after the very request that made it 3/3, and the
    // only fix available to the user is a page reload.
    const { emitQuotaDenied } = await import('@resomix/api-client');
    await given();
    const callsBefore = getMyEntitlements.mock.calls.length;

    emitQuotaDenied('quota_exceeded');

    await waitFor(() => expect(getMyEntitlements.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('shows the new numbers after the refresh', async () => {
    const { emitQuotaDenied } = await import('@resomix/api-client');
    const spent = {
      is_frontend: true,
      is_guest: false,
      plan: { code: 'free', name: 'Free', is_default: true },
      entitlements: {},
      limits: FREE_LIMITS,
      usage: { ...FREE_USAGE, searches_used_today: 3 },
      resets: RESETS,
    };

    getMyEntitlements.mockResolvedValue({
      success: true,
      data: {
        is_frontend: true, is_guest: false,
        plan: { code: 'free', name: 'Free', is_default: true },
        entitlements: {}, limits: FREE_LIMITS, usage: FREE_USAGE, resets: RESETS,
      },
    });
    const { result } = renderHook(() => useUsageChip());
    await waitFor(() => expect(result.current.metrics.length).toBeGreaterThan(0));
    expect(result.current.metrics.find((m) => m.key === 'searches')?.spent).toBe(false);

    getMyEntitlements.mockResolvedValue({ success: true, data: spent });
    emitQuotaDenied('quota_exceeded');

    await waitFor(() =>
      expect(result.current.metrics.find((m) => m.key === 'searches')?.spent).toBe(true),
    );
  });

  it('forces past the cache', async () => {
    // The shared cache is precisely what went stale, so a cache-respecting reload would return the
    // same wrong numbers and the refresh would be a no-op.
    const { emitQuotaDenied } = await import('@resomix/api-client');
    await given();
    const callsBefore = getMyEntitlements.mock.calls.length;

    emitQuotaDenied(null);

    await waitFor(() => expect(getMyEntitlements.mock.calls.length).toBe(callsBefore + 1));
  });
});

describe('next reset', () => {
  it('reports the soonest reset among the shown metrics', async () => {
    // search_at is sooner than upload_at; ISO-8601 with a fixed offset sorts as a string.
    expect((await given()).nextResetAt).toBe('2026-08-07T00:00:00+00:00');
  });

  it('ignores the reset of a metric that is not shown', async () => {
    const result = await given({
      limits: { ...FREE_LIMITS, searches_per_day: null, exports_per_day: null },
    });
    expect(result.nextResetAt).toBe('2026-08-20T09:00:00+00:00');
  });

  it('is null when nothing is shown', async () => {
    expect((await given({}, { pending: true })).nextResetAt).toBeNull();
  });
});
