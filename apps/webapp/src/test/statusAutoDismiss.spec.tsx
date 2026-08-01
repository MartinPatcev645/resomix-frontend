import { render, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatusDialog } from '@resomix/ui';

const onClose = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  onClose.mockClear();
});
afterEach(() => vi.useRealTimers());

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/**
 * Terminal statuses close themselves so nobody has to dismiss a modal that only says "done".
 *
 * Confirmations go quickly; errors linger. An error is unexpected, often carries detail worth
 * reading, and is the thing someone wants time to screenshot before reporting it — so it gets
 * meaningfully longer than a success, which is read at a glance.
 */
describe('StatusDialog auto-dismiss', () => {
  it('closes a success at 2.5s', () => {
    render(<StatusDialog isOpen status="success" message="Renamed" onClose={onClose} />);

    advance(2499);
    expect(onClose).not.toHaveBeenCalled();
    advance(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps an error up for 8s', () => {
    render(<StatusDialog isOpen status="error" message="Something went wrong" onClose={onClose} />);

    // Still there well past the success timing — this is the whole point.
    advance(2600);
    expect(onClose).not.toHaveBeenCalled();

    advance(7999 - 2600);
    expect(onClose).not.toHaveBeenCalled();
    advance(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes an info at 2.5s', () => {
    render(<StatusDialog isOpen status="info" message="Heads up" onClose={onClose} />);

    advance(2501);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('never closes a loading dialog — it is not terminal', () => {
    render(<StatusDialog isOpen status="loading" message="Working" onClose={onClose} />);

    advance(60_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never closes a dialog carrying an action — the user has something to reach for', () => {
    render(
      <StatusDialog
        isOpen
        status="error"
        message="Email already registered"
        action={{ label: 'Sign in instead', onClick: vi.fn() }}
        onClose={onClose}
      />,
    );

    advance(60_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('respects autoDismiss={false}', () => {
    render(
      <StatusDialog isOpen status="error" message="Read me" autoDismiss={false} onClose={onClose} />,
    );

    advance(60_000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('re-arms at the longer time when a dialog flips from success to error', () => {
    const { rerender } = render(
      <StatusDialog isOpen status="success" message="Saved" onClose={onClose} />,
    );

    advance(1000);
    rerender(<StatusDialog isOpen status="error" message="Actually, failed" onClose={onClose} />);

    // The success timer must not carry over and close the error early.
    advance(2000);
    expect(onClose).not.toHaveBeenCalled();
    advance(6001);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
