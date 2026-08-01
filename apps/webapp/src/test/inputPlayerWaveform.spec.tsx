import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import InputPlayer from '../components/Playlist/InputPlayer.tsx';

const attachOverviewElement = vi.fn();
let isPreview = false;
let wfLoading = false;

vi.mock('@resomix/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resomix/hooks')>();
  return {
    ...actual,
    useGlobalAudioController: () => ({ load: vi.fn(), getDuration: () => 30 }),
    useWaveformControls: () => ({
      containerRef: { current: null },
      attachOverviewElement,
      wfLoading,
      wfError: null,
      isDragging: false,
      uiTime: 0,
      isPlaying: false,
      togglePlay: vi.fn(),
      skipBackward: vi.fn(),
      skipForward: vi.fn(),
      volume: 1,
      handleVolumeChange: vi.fn(),
      toggleMute: vi.fn(),
      isPreview,
      getPlayableDuration: () => 30,
      seekTo: vi.fn(),
    }),
  };
});

beforeEach(() => {
  attachOverviewElement.mockClear();
  isPreview = false;
  wfLoading = false;
});

/** Peaks.js draws into a plain div, so identify it by the ref handed to attachOverviewElement. */
const attachedElement = () => attachOverviewElement.mock.calls[0]?.[0] as HTMLElement | undefined;

/**
 * The reference track in the playlist hero.
 *
 * An upload streams over HLS and we fetch real peaks for it, so it must render a WAVEFORM. A
 * catalogue track plays from an Apple Music preview URL and has no peaks at all, so it keeps the
 * plain progress line. The hero previously rendered the progress line for both — it never used the
 * `attachOverviewElement` / `isPreview` the controls hook was already handing it.
 */
describe('InputPlayer seek visualisation', () => {
  it('draws a waveform for an uploaded reference track', () => {
    isPreview = false;
    render(<InputPlayer trackId="upload-1" totalDuration={200} />);

    expect(attachOverviewElement).toHaveBeenCalledTimes(1);
    expect(attachedElement()).toBeInstanceOf(HTMLElement);
  });

  it('does NOT draw a waveform for a catalogue (Apple preview) track', () => {
    isPreview = true;
    render(<InputPlayer trackId="catalogue-1" totalDuration={200} />);

    // No peaks exist for a preview track — attaching would leave an empty container.
    expect(attachOverviewElement).not.toHaveBeenCalled();
  });

  it('hides the waveform but keeps it mounted while peaks load', () => {
    wfLoading = true;
    render(<InputPlayer trackId="upload-1" totalDuration={200} />);

    // Still attached — Peaks.js needs the element before it can draw into it.
    expect(attachOverviewElement).toHaveBeenCalledTimes(1);
    expect(attachedElement()).toHaveClass('invisible');
  });

  it('shows the waveform once peaks have loaded', () => {
    wfLoading = false;
    render(<InputPlayer trackId="upload-1" totalDuration={200} />);

    expect(attachedElement()).toHaveClass('visible');
  });

  it('renders on the mobile layout too', () => {
    isPreview = false;
    render(<InputPlayer trackId="upload-1" totalDuration={200} mobile />);

    expect(screen.getByTestId('input-player')).toBeInTheDocument();
    expect(attachOverviewElement).toHaveBeenCalledTimes(1);
  });
});
