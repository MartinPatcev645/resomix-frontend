import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useStopPlaybackOnNavigate } from '../hooks/useStopPlaybackOnNavigate.ts';

const stop = vi.fn();

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return { ...actual, useGlobalAudioController: () => ({ stop }) };
});

let navigate: ReturnType<typeof useNavigate>;

function Harness() {
  useStopPlaybackOnNavigate();
  navigate = useNavigate();
  return null;
}

function mountAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

const go = (url: string) => act(() => { navigate(url); });

beforeEach(() => stop.mockClear());

/**
 * Playback state is global and outlives routes. Without this, playing a reference track then
 * opening a different playlist left the new hero showing a pause button over the old track's
 * progress — you had to press pause, then play, to start the track you were looking at.
 */
describe('useStopPlaybackOnNavigate', () => {
  it('does not stop playback on first arrival', () => {
    mountAt('/sonic-discovery?id=playlist-a');
    expect(stop).not.toHaveBeenCalled();
  });

  it('stops when moving to a different playlist — the reported bug', () => {
    mountAt('/sonic-discovery?id=playlist-a');
    go('/library');
    go('/sonic-discovery?id=playlist-b');

    expect(stop).toHaveBeenCalledTimes(2); // once leaving for /library, once opening playlist B
  });

  it('stops when leaving the page entirely', () => {
    mountAt('/sonic-discovery?id=playlist-a');
    go('/analysis');

    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('does not stop when only unrelated query params change on the same playlist', () => {
    mountAt('/sonic-discovery?id=playlist-a');
    go('/sonic-discovery?id=playlist-a&tab=matches');

    expect(stop).not.toHaveBeenCalled();
  });

  it('does not stop when re-navigating to the identical route', () => {
    mountAt('/sonic-discovery?id=playlist-a');
    go('/sonic-discovery?id=playlist-a');

    expect(stop).not.toHaveBeenCalled();
  });

  /**
   * Background playback has to survive a tab switch, so this hook must never observe visibility.
   * If someone later "improves" it by adding a visibilitychange listener, this fails.
   */
  it('ignores tab visibility changes', () => {
    mountAt('/sonic-discovery?id=playlist-a');

    act(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(stop).not.toHaveBeenCalled();
  });
});
