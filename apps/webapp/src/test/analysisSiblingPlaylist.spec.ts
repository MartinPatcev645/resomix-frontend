import { renderHook, waitFor } from '@testing-library/react';
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

const succeeded = (playlistUuid?: string) => ({
  success: true,
  data: {
    state: 'succeeded',
    part1_ready: true,
    progress: { percent: 100 },
    track_uuid: 'track-uuid',
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
    // The job is already done on the first poll and has no sibling yet — this is the case that
    // used to leave the CTA dead forever.
    getAnalysisStatus
      .mockResolvedValueOnce(succeeded())
      .mockResolvedValue(succeeded(PLAYLIST_UUID));

    const { result } = await loadAnalysis();

    expect(result.current.status).toBe('done');
    expect(result.current.playlistUuid).toBeNull();

    await waitFor(() => expect(result.current.playlistUuid).toBe(PLAYLIST_UUID), { timeout: 8000 });
    await waitFor(() => expect(result.current.playlistPending).toBe(false));
  }, 15000);

  it('reports pending while it is still watching, so the CTA can show a loader', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded()); // never pairs during the test

    const { result } = await loadAnalysis();

    await waitFor(() => expect(result.current.playlistPending).toBe(true));
    expect(result.current.playlistUuid).toBeNull();
  }, 15000);

  it('does not watch at all when the playlist arrived with the analysis', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded(PLAYLIST_UUID));

    const { result } = await loadAnalysis();

    expect(result.current.playlistUuid).toBe(PLAYLIST_UUID);
    // No follow-up poll — the id was already there, so the CTA is live immediately.
    expect(result.current.playlistPending).toBe(false);
  }, 15000);

  it('stops watching when the run is superseded by a reset', async () => {
    getAnalysisStatus.mockResolvedValue(succeeded());

    const { result } = await loadAnalysis();
    await waitFor(() => expect(result.current.playlistPending).toBe(true));

    result.current.reset();

    await waitFor(() => expect(result.current.playlistPending).toBe(false));
    expect(result.current.playlistUuid).toBeNull();
  }, 15000);
});
