import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncJobPolling } from "@/features/bandcamp/hooks/useSyncJobPolling.ts";
import { BandcampApiError, type BandcampSyncState } from "@/features/bandcamp/api/types.ts";

const syncing = (processed: number, total: number | null = 30): BandcampSyncState => ({
  status: "syncing",
  processed,
  total,
  error: null,
});

/** Resolves pending promises and runs due timers. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useSyncJobPolling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does nothing without a job", () => {
    const fetchSync = vi.fn();
    const { result } = renderHook(() => useSyncJobPolling(null, { fetchSync }));
    expect(result.current.status).toBe("idle");
    expect(fetchSync).not.toHaveBeenCalled();
  });

  it("reports progress and stops polling once ready", async () => {
    const fetchSync = vi
      .fn()
      .mockResolvedValueOnce(syncing(6))
      .mockResolvedValueOnce(syncing(18))
      .mockResolvedValueOnce({ status: "ready", processed: 30, total: 30, error: null });
    const { result } = renderHook(() => useSyncJobPolling("job-1", { fetchSync, intervalMs: 2500 }));

    await advance(0);
    expect(result.current).toMatchObject({ status: "syncing", processed: 6, total: 30 });
    await advance(2500);
    expect(result.current.processed).toBe(18);
    await advance(2500);
    expect(result.current.status).toBe("ready");

    await advance(20_000);
    expect(fetchSync).toHaveBeenCalledTimes(3);
  });

  it("stops on a failed job and keeps the backend's message", async () => {
    const fetchSync = vi.fn().mockResolvedValue({ status: "failed", processed: 4, total: 30, error: "Bandcamp timed out" });
    const { result } = renderHook(() => useSyncJobPolling("job-1", { fetchSync }));
    await advance(0);
    expect(result.current).toMatchObject({ status: "failed", error: "Bandcamp timed out" });
    await advance(20_000);
    expect(fetchSync).toHaveBeenCalledTimes(1);
  });

  it("never overlaps requests when the server is slower than the interval", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchSync = vi.fn(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 7000));
      inFlight -= 1;
      return syncing(1);
    });
    renderHook(() => useSyncJobPolling("job-1", { fetchSync, intervalMs: 1000 }));
    await advance(30_000);
    expect(maxInFlight).toBe(1);
    // 7s request + 1s gap per cycle.
    expect(fetchSync.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("clears its timer and aborts the in-flight request on unmount", async () => {
    const signals: AbortSignal[] = [];
    const fetchSync = vi.fn((_: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<BandcampSyncState>(() => {});
    });
    const { unmount } = renderHook(() => useSyncJobPolling("job-1", { fetchSync }));
    await advance(0);
    expect(signals).toHaveLength(1);
    unmount();
    expect(signals[0].aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no pending timer after unmounting between polls", async () => {
    const fetchSync = vi.fn().mockResolvedValue(syncing(3));
    const { unmount } = renderHook(() => useSyncJobPolling("job-1", { fetchSync, intervalMs: 2500 }));
    await advance(0);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await advance(10_000);
    expect(fetchSync).toHaveBeenCalledTimes(1);
  });

  it("restarts from scratch when the job id changes", async () => {
    const signals: AbortSignal[] = [];
    const fetchSync = vi.fn((jobId: string, signal: AbortSignal) => {
      signals.push(signal);
      return Promise.resolve(jobId === "job-1" ? syncing(5) : syncing(1, null));
    });
    const { result, rerender } = renderHook(({ id }) => useSyncJobPolling(id, { fetchSync }), {
      initialProps: { id: "job-1" },
    });
    await advance(0);
    expect(result.current.processed).toBe(5);
    rerender({ id: "job-2" });
    await advance(0);
    expect(fetchSync).toHaveBeenLastCalledWith("job-2", expect.any(AbortSignal));
    expect(result.current).toMatchObject({ processed: 1, total: null });
    await advance(10_000);
    expect(fetchSync.mock.calls.filter(([id]) => id === "job-1")).toHaveLength(1);
  });

  it("retries network errors with backoff, then gives up and reports", async () => {
    const fetchSync = vi.fn().mockRejectedValue(new BandcampApiError("network", "offline"));
    const { result } = renderHook(() =>
      useSyncJobPolling("job-1", { fetchSync, intervalMs: 1000, maxConsecutiveFailures: 3 }),
    );
    await advance(0);
    expect(result.current.requestError).toBeNull();
    await advance(60_000);
    expect(fetchSync).toHaveBeenCalledTimes(3);
    expect(result.current.requestError?.kind).toBe("network");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops immediately on errors that will not fix themselves", async () => {
    const fetchSync = vi.fn().mockRejectedValue(new BandcampApiError("not_connected", "gone", 404));
    const { result } = renderHook(() => useSyncJobPolling("job-1", { fetchSync }));
    await advance(0);
    expect(result.current.requestError?.kind).toBe("not_connected");
    await advance(20_000);
    expect(fetchSync).toHaveBeenCalledTimes(1);
  });

  it("restart() polls the same job again after it stopped", async () => {
    const fetchSync = vi
      .fn()
      .mockResolvedValueOnce({ status: "failed", processed: 1, total: 30, error: "x" })
      .mockResolvedValueOnce(syncing(2));
    const { result } = renderHook(() => useSyncJobPolling("job-1", { fetchSync }));
    await advance(0);
    expect(result.current.status).toBe("failed");
    act(() => result.current.restart());
    await advance(0);
    expect(result.current.status).toBe("syncing");
  });
});
