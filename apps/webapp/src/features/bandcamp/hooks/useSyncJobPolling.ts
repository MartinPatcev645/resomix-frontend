import { useCallback, useEffect, useRef, useState } from "react";
import { getBandcampSync, mapError } from "../api/bandcampApi.ts";
import type { BandcampApiError, BandcampSyncState, BandcampSyncStatus } from "../api/types.ts";

export interface SyncPollingState {
  status: BandcampSyncStatus | "idle";
  processed: number;
  total: number | null;
  /** The backend's own failure message when `status` is "failed". */
  error: string | null;
  /** Set when polling itself gave up (network, auth, job gone…); polling has stopped. */
  requestError: BandcampApiError | null;
}

export interface SyncPollingOptions {
  intervalMs?: number;
  maxConsecutiveFailures?: number;
  fetchSync?: (jobId: string, signal: AbortSignal) => Promise<BandcampSyncState>;
}

const IDLE: SyncPollingState = { status: "idle", processed: 0, total: null, error: null, requestError: null };
const STARTING: SyncPollingState = { ...IDLE, status: "pending" };

const RETRYABLE = new Set(["network", "unknown", "rate_limited"]);

/**
 * Polls `GET /bandcamp/sync/{jobId}` until the job is ready or failed.
 *
 * The next request is scheduled only after the previous one settles, so requests never overlap.
 * Unmounting, or a new `jobId`, clears the timer and aborts the request in flight. Transient
 * failures back off and retry; after `maxConsecutiveFailures` the hook stops and reports.
 */
export function useSyncJobPolling(jobId: string | null, options: SyncPollingOptions = {}) {
  const { intervalMs = 2500, maxConsecutiveFailures = 3, fetchSync = getBandcampSync } = options;
  const [state, setState] = useState<SyncPollingState>(IDLE);
  const [restartToken, setRestartToken] = useState(0);
  const fetchRef = useRef(fetchSync);
  fetchRef.current = fetchSync;

  useEffect(() => {
    if (!jobId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;
    let failures = 0;
    setState(STARTING);

    const tick = async () => {
      timer = null;
      controller = new AbortController();
      try {
        const next = await fetchRef.current(jobId, controller.signal);
        if (cancelled) return;
        failures = 0;
        setState({ ...next, requestError: null });
        if (next.status !== "ready" && next.status !== "failed") {
          timer = setTimeout(tick, intervalMs);
        }
      } catch (raw) {
        if (cancelled) return;
        const error = mapError(raw, "sync");
        if (error.kind === "aborted") return;
        failures += 1;
        if (RETRYABLE.has(error.kind) && failures < maxConsecutiveFailures) {
          timer = setTimeout(tick, intervalMs * 2 ** failures);
          return;
        }
        setState((prev) => ({ ...prev, requestError: error }));
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [jobId, intervalMs, maxConsecutiveFailures, restartToken]);

  const restart = useCallback(() => setRestartToken((n) => n + 1), []);

  return { ...state, restart };
}
