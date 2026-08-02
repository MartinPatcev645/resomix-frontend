import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * "Find similar tracks" was permanently greyed out after an analysis.
 *
 * The CTA is gated on the sibling similarity playlist's uuid, which the backend attaches to the
 * analysis status doc. But that playlist is paired asynchronously and best-effort, while the main
 * poll stops the instant the job reports "succeeded" — so on a fast analysis the id was simply
 * never observed, and the button stayed dead for a playlist that existed seconds later.
 *
 * The hook now keeps watching (bounded) after the job finishes, and reports `playlistPending` so
 * the disabled button can show a spinner instead of looking broken.
 */

const getAnalysisStatus = vi.fn();
const getAnalysisResult = vi.fn();
const mintAnalysisToken = vi.fn();

vi.mock('@resomix/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/api-client')>();
  return {
    ...actual,
    getAnalysisStatus: (id: string) => getAnalysisStatus(id),
    getAnalysisResult: (id: string) => getAnalysisResult(id),
    mintAnalysisToken: (id: string) => mintAnalysisToken(id),
    uploadForAnalysis: vi.fn(),
  };
});

const ANALYSIS_ID = 'analysis-uuid';
const PLAYLIST_UUID = 'sibling-playlist-uuid';
/** Mirrors SIBLING_POLL_INTERVAL_MS in the hook. */
const SIBLING_INTERVAL_MS = 2500;

const succeeded = (sibling: string, playlistUuid?: string) => ({
  success: true,
  data: {
    state: 'succeeded',
    part1_ready: true,
    progress: { percent: 100 },
    track_uuid: 'track-uuid',
    sibling_playlist_state: sibling,
    ...(playlistUuid ? { playlist_uuid: playlistUuid } : {}),
  },
});

async function loadAnalysis() {
  const { useTrackAnalysis } = await import('../pages/analysis/useTrackAnalysis.ts');
  const hook = renderHook(() => useTrackAnalysis());
  await hook.result.current.loadById(ANALYSIS_ID);
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  // The mapper is deliberately defensive, so an empty canonical doc is a valid "finished" result.
  getAnalysisResult.mockResolvedValue({ success: true, data: {} });
  // Force the direct-cache path to fail so the fetch falls back to the mocked proxy result.
  mintAnalysisToken.mockResolvedValue({ success: false });
});

describe('sibling similarity playlist after an analysis completes', () => {
  it('picks up a playlist that is paired only after the job succeeds', async () => {
    // Job already done, sibling still generating — the case that used to leave the CTA dead.
    getAnalysisStatus
      .mockResolvedValueOnce(succeeded('pending'))
      .mockResolvedValue(succeeded('ready', PLAYLIST_UUID));

    const { result } = await loadAnalysis();

    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.playlistUuid).toBeNull();

    await waitFor(() => expect(result.current.playlistUuid).toBe(PLAYLIST_UUID), { timeout: 9000 });
    await waitFor(() => expect(result.current.playlistPending).toBe(false));
  }, 20000);

  it('reports pending while the server says the sibling is still generating', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded('pending'));

    const { result } = await loadAnalysis();

    await waitFor(() => expect(result.current.playlistPending).toBe(true));
    expect(result.current.playlistUuid).toBeNull();
  }, 20000);

  it('does not watch at all when the playlist arrived with the analysis', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded('ready', PLAYLIST_UUID));

    const { result } = await loadAnalysis();

    await waitFor(() => expect(result.current.playlistUuid).toBe(PLAYLIST_UUID));
    expect(result.current.playlistPending).toBe(false);
  }, 20000);

  /**
   * The whole point of the explicit state. "No playlist_uuid" alone cannot distinguish these from
   * "still coming", which is what made the old blind poll spin for its full timeout and hold a
   * loader on a button that was never going to enable.
   */
  it.each(['unavailable', 'failed'])(
    'never starts a watch when the server reports %s',
    async (state) => {
      getAnalysisStatus.mockResolvedValue(succeeded(state));

      const { result } = await loadAnalysis();

      await waitFor(() => expect(result.current.status).toBe('done'));
      expect(result.current.playlistPending).toBe(false);
      expect(result.current.playlistUuid).toBeNull();

      // And it stays that way — no background poll quietly running.
      const callsAfterLoad = getAnalysisStatus.mock.calls.length;
      await new Promise((r) => setTimeout(r, SIBLING_INTERVAL_MS + 800));
      expect(getAnalysisStatus.mock.calls.length).toBe(callsAfterLoad);
      expect(result.current.playlistPending).toBe(false);
    },
    20000,
  );

  it('stops watching as soon as the sibling turns terminal', async () => {
    getAnalysisStatus
      .mockResolvedValueOnce(succeeded('pending'))
      .mockResolvedValue(succeeded('unavailable'));

    const { result } = await loadAnalysis();
    await waitFor(() => expect(result.current.playlistPending).toBe(true));

    // Ends on the state, not on the 3-minute backstop.
    await waitFor(() => expect(result.current.playlistPending).toBe(false), { timeout: 9000 });
    expect(result.current.playlistUuid).toBeNull();
  }, 20000);

  it('stops watching when the run is superseded by a reset', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded('pending'));

    const { result } = await loadAnalysis();
    await waitFor(() => expect(result.current.playlistPending).toBe(true));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.playlistPending).toBe(false));
    expect(result.current.playlistUuid).toBeNull();
  }, 20000);
});
