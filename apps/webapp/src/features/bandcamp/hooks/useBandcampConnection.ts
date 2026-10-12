import { useCallback, useEffect, useState } from "react";
import { connectBandcamp, disconnectBandcamp, getBandcampConnection, mapError } from "../api/bandcampApi.ts";
import type { BandcampApiError, BandcampConnectionState } from "../api/types.ts";
import { useSyncJobPolling, type SyncPollingOptions, type SyncPollingState } from "./useSyncJobPolling.ts";

export type ConnectionPhase = "checking" | "check_failed" | "disconnected" | "syncing" | "ready";

/** Shown when the page opens on a sync that already failed: there is no job left to poll. */
const FAILED_ON_LOAD: SyncPollingState = { status: "failed", processed: 0, total: null, error: null, requestError: null };

function phaseFor(state: BandcampConnectionState): ConnectionPhase {
  if (!state.connected) return "disconnected";
  if (state.activeJobId) return "syncing";
  // A failed sync keeps the rows it imported, so only an empty failure shows the failure view.
  if (state.status === "failed" && state.itemCount === 0) return "syncing";
  return "ready";
}

/**
 * The page's state machine: is there a connection, is a sync running, did it fail.
 *
 * `GET /bandcamp/connection` answers on open, including the job to resume after a reload.
 */
export function useBandcampConnection(pollingOptions?: SyncPollingOptions) {
  const [phase, setPhase] = useState<ConnectionPhase>("checking");
  const [username, setUsername] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<BandcampApiError | null>(null);
  const [connectError, setConnectError] = useState<BandcampApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<BandcampApiError | null>(null);
  const [checkToken, setCheckToken] = useState(0);
  const [connectionState, setConnectionState] = useState<BandcampConnectionState | null>(null);

  useEffect(() => {
    if (phase !== "checking") return;
    const controller = new AbortController();
    getBandcampConnection(controller.signal)
      .then((state) => {
        setConnectionState(state);
        setUsername(state.username);
        setJobId(state.activeJobId);
        setPhase(phaseFor(state));
      })
      .catch((raw) => {
        const error = mapError(raw, "connection");
        if (error.kind === "aborted") return;
        setCheckError(error);
        setPhase("check_failed");
      });
    return () => controller.abort();
  }, [phase, checkToken]);

  const polling = useSyncJobPolling(phase === "syncing" ? jobId : null, pollingOptions);

  useEffect(() => {
    if (phase !== "syncing" || !jobId) return;
    if (polling.requestError?.kind === "not_connected") {
      // The job is gone (disconnected elsewhere, or cleaned up) — ask the backend again.
      setJobId(null);
      setPhase("checking");
      return;
    }
    if (polling.status !== "ready") return;

    // Refresh matched count and any early-stop message before showing the collection.
    let cancelled = false;
    getBandcampConnection()
      .then((state) => {
        if (cancelled) return;
        setConnectionState(state);
        setUsername(state.username);
        setJobId(state.activeJobId);
        setPhase(phaseFor(state));
      })
      .catch((raw) => {
        if (cancelled) return;
        const error = mapError(raw, "connection");
        if (error.kind === "aborted") return;
        setJobId(null);
        setPhase("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [phase, jobId, polling.status, polling.requestError]);

  const connect = useCallback(
    async (name: string) => {
      setSubmitting(true);
      setConnectError(null);
      try {
        const { jobId: next } = await connectBandcamp(name);
        const sameJob = next === jobId;
        setJobId(next);
        setUsername(name);
        setPhase("syncing");
        // Reconnecting during a running sync returns the same job; poll it again from the top.
        if (sameJob) polling.restart();
        return true;
      } catch (raw) {
        setConnectError(mapError(raw, "connect"));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [jobId, polling],
  );

  const retrySync = useCallback(() => {
    if (username) return connect(username);
    setPhase("disconnected");
    return Promise.resolve(false);
  }, [connect, username]);

  const recheck = useCallback(() => {
    setCheckError(null);
    setPhase("checking");
    setCheckToken((n) => n + 1);
  }, []);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setDisconnectError(null);
    try {
      await disconnectBandcamp();
    } catch (raw) {
      const error = mapError(raw, "disconnect");
      if (error.kind !== "not_connected") {
        setDisconnectError(error);
        setDisconnecting(false);
        return false;
      }
    }
    setJobId(null);
    setUsername(null);
    setConnectionState(null);
    setConnectError(null);
    setPhase("disconnected");
    setDisconnecting(false);
    return true;
  }, []);

  return {
    phase,
    username,
    matchedCount: connectionState?.matchedCount ?? null,
    importError: connectionState?.connected ? connectionState.errorMessage : null,
    sync: phase === "syncing" && !jobId ? { ...FAILED_ON_LOAD, restart: polling.restart } : polling,
    checkError,
    connectError,
    submitting,
    connect,
    retrySync,
    recheck,
    disconnect,
    disconnecting,
    disconnectError,
    clearDisconnectError: () => setDisconnectError(null),
  };
}
