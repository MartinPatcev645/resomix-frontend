import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useQuotaDenial } from '@resomix/hooks';
import { emitQuotaDenied, type QuotaDenial } from '@resomix/api-client';

/**
 * A 402 anywhere opens the right modal (pricing v2.1, E2).
 *
 * The modal is mounted ONCE at the app root and driven by the API layer, not by call sites. That is
 * the point: every metered endpoint would otherwise need its own wiring, and the next one added
 * would silently ship without any.
 *
 * The subtle rule is what happens to a denial we do not understand. It must not clear a modal that
 * is currently showing something we DID understand — a second, unrecognised 402 arriving while the
 * user reads the first would otherwise blank the dialog mid-sentence.
 */

const denial = (over: Partial<QuotaDenial> = {}): QuotaDenial => ({
  code: 'quota_exceeded',
  error: 'server sentence',
  reason: 'upgrade_required',
  quota: { metric: 'search_playlists_per_month', used: 3, limit: 3 },
  ...over,
});

describe('quota denial gate', () => {
  it('shows nothing until a denial arrives', () => {
    const { result } = renderHook(() => useQuotaDenial());
    expect(result.current.copy).toBeNull();
  });

  it('opens on a 402 from anywhere', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial()));
    await waitFor(() => expect(result.current.copy).not.toBeNull());
    expect(result.current.copy?.body).toContain("today's");
  });

  it('exposes the raw denial for callers that want the numbers', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial()));
    await waitFor(() => expect(result.current.denial?.quota?.limit).toBe(3));
  });

  it('closes when dismissed', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial()));
    await waitFor(() => expect(result.current.copy).not.toBeNull());
    act(() => result.current.clear());
    await waitFor(() => expect(result.current.copy).toBeNull());
  });

  it('ignores a denial it cannot describe', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial({ code: 'something_new', reason: null })));
    await waitFor(() => expect(result.current.copy).toBeNull());
  });

  it('does not blank a showing modal when an unrecognised denial arrives', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial()));
    await waitFor(() => expect(result.current.copy).not.toBeNull());

    act(() => emitQuotaDenied(denial({ code: 'something_new', reason: null })));

    // Still showing the one we could describe, rather than clearing mid-sentence.
    expect(result.current.copy).not.toBeNull();
  });

  it('replaces the copy when a different denial arrives', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() => emitQuotaDenied(denial()));
    await waitFor(() => expect(result.current.copy?.title).toBe('Daily searches used'));

    act(() =>
      emitQuotaDenied(denial({ code: 'library_full', quota: { metric: 'library_playlists_max', limit: 5 } })),
    );
    await waitFor(() => expect(result.current.copy?.title).toBe('Library is full'));
  });

  it('unsubscribes on unmount', async () => {
    // A page that mounts and unmounts must not leave a listener holding a dead setState behind —
    // React warns, and every future 402 pays for it.
    const { result, unmount } = renderHook(() => useQuotaDenial());
    unmount();
    emitQuotaDenied(denial());
    expect(result.current.copy).toBeNull();
  });

  it('routes a guest denial to the signup CTA', async () => {
    const { result } = renderHook(() => useQuotaDenial());
    act(() =>
      emitQuotaDenied(
        denial({ code: 'login_required', reason: 'login_required', error: 'Create a free account.', quota: null }),
      ),
    );
    // A guest has no account to upgrade.
    await waitFor(() => expect(result.current.copy?.reason).toBe('login_required'));
  });
});
