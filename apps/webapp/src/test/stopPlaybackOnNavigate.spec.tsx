import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { usePlayerStore } from '@resomix/stores';
import { useStopPlaybackOnNavigate } from '../hooks/useStopPlaybackOnNavigate.ts';

const stop = vi.fn();

/**
 * NOTE: `useGlobalAudioController` is deliberately NOT mocked.
 *
 * An earlier version of this file mocked it, and that is precisely why these tests stayed green
 * while the app rendered a blank page: the real hook throws "AudioProvider is missing in the tree"
 * when no provider is above it, and the provider lives deep inside the playlist pages — far below
 * the shell this hook runs in. Mocking the dependency mocked away the bug. The controller now
 * comes from the store, and the first test below pins the no-provider case directly.
 */
beforeEach(() => {
  stop.mockClear();
  usePlayerStore.setState({ audioController: { stop } as never });
});
afterEach(() => {
  usePlayerStore.setState({ audioController: null });
});

let navigate: ReturnType<typeof useNavigate>;

function Harness() {
  useStopPlaybackOnNavigate();
  navigate = useNavigate();
  return <div data-testid="alive">ok</div>;
}

function mountAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

const go = (url: string) => act(() => { navigate(url); });

describe('useStopPlaybackOnNavigate', () => {
  /**
   * The regression that blanked the app. This hook runs in WebLayout, which is ABOVE every
   * AudioProvider in the tree, so it must not require one.
   */
  it('renders without an AudioProvider anywhere in the tree', () => {
    usePlayerStore.setState({ audioController: null });

    const { getByTestId } = mountAt('/sonic-discovery?id=playlist-a');

    expect(getByTestId('alive')).toBeTruthy();
  });

  it('is a no-op when no controller has been created yet', () => {
    usePlayerStore.setState({ audioController: null });
    mountAt('/sonic-discovery?id=playlist-a');

    expect(() => go('/library')).not.toThrow();
  });

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
    go('/track-intelligence');

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
