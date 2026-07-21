import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAppleConnection,
  saveAppleConnection,
  deleteAppleConnection,
  transferPlaylistToApple,
  type AppleEnvelope,
  type AppleTransferResult,
} from '@resomix/api-client';
import {
  initializeAppleMusicAuth,
  clearAppleAuth,
  clearGuardKey,
} from './appleService';

type StatusFn = (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;

export type AppleNotice = { kind: 'success' | 'error' | 'info'; text: string } | null;

interface UseAppleTransferParams {
  active: boolean;
  initialPlaylistId?: string;
  onStatusChange?: StatusFn;
}

/** User-facing copy — no raw API/Apple errors are ever shown; everything maps to these. */
const MSG = {
  connecting: 'Waiting for you to finish sign-in in the Apple Music window…',
  connected: 'Your Apple Music account is connected.',
  cancelled: 'Apple Music sign-in was cancelled. You can try connecting again.',
  blocked: 'Your browser blocked the sign-in window. Please allow pop-ups and try again.',
  connectFailed: 'We couldn’t connect your Apple Music account. Please try again.',
  transferring: 'Adding your playlist to Apple Music…',
  notConnected: 'Please connect your Apple Music account first.',
  sessionExpired: 'Your Apple Music session ended. Please reconnect your account.',
  transferFailed:
    'We couldn’t add this playlist to Apple Music. Make sure you have an active Apple Music subscription, then try again.',
  planBlocked: 'Apple Music export isn’t available on your plan.',
  disconnected: 'Your Apple Music account has been disconnected.',
  generic: 'Something went wrong. Please try again.',
};

const CONNECT_TIMEOUT_MS = 2 * 60 * 1000;
const POLL_MS = 800;

/** Map a failed envelope to a standard message (never surfaces the raw server/Apple text). */
function mapError(env: AppleEnvelope<unknown>, ctx: 'connect' | 'transfer'): string {
  const status = env.status;
  const raw = (env.error || '').toLowerCase();
  if (status === 403 || env.reason === 'upgrade_required') return MSG.planBlocked;
  if (status === 401 || raw.includes('expired') || raw.includes('reconnect')) return MSG.sessionExpired;
  if (raw.includes('not connected') || raw.includes('connect your apple')) return MSG.notConnected;
  return ctx === 'connect' ? MSG.connectFailed : MSG.transferFailed;
}

/**
 * Apple Music connection + transfer, backed by the SERVER connection (persisted per account, so the
 * user links once and it survives sessions/devices). MusicKit sign-in happens in a popup that writes
 * the user token to localStorage; we read it once, persist it server-side, then clear the local copy.
 */
export function useAppleTransfer({ active, initialPlaylistId, onStatusChange }: UseAppleTransferParams) {
  const playlistId = useMemo(
    () => initialPlaylistId ?? new URLSearchParams(window.location.search).get('id') ?? '',
    [initialPlaylistId]
  );

  const [connected, setConnected] = useState(false);
  const [storefront, setStorefront] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [notice, setNotice] = useState<AppleNotice>(null);
  const [result, setResult] = useState<AppleTransferResult | null>(null);

  const pollRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Fetch the authoritative connection status from the server.
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await getAppleConnection();
    if (!mountedRef.current) return;
    if (res.success && res.data) {
      setConnected(!!res.data.connected);
      setStorefront(res.data.storefront ?? null);
    } else {
      setConnected(false);
    }
    setStatusLoading(false);
  }, []);

  // On open: reset transient UI and load status. On close/unmount: stop any poll.
  useEffect(() => {
    mountedRef.current = true;
    if (!active) return;
    setNotice(null);
    setResult(null);
    setConnectLoading(false);
    setTransferLoading(false);
    void refreshStatus();
    return () => {
      mountedRef.current = false;
      stopPoll();
    };
  }, [active, refreshStatus, stopPoll]);

  // Kick off the MusicKit sign-in popup, then wait for the returned token and persist it.
  const connect = useCallback(async () => {
    stopPoll();
    setNotice({ kind: 'info', text: MSG.connecting });
    setConnectLoading(true);
    try {
      clearAppleAuth();          // drop any stale local token so we only react to this sign-in
      clearGuardKey(playlistId);
      await initializeAppleMusicAuth(playlistId);
    } catch {
      // window.open threw (almost always a blocked pop-up)
      setConnectLoading(false);
      setNotice({ kind: 'error', text: MSG.blocked });
      return;
    }

    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      const lastError = localStorage.getItem('apple_last_error');
      const mut = localStorage.getItem('apple_music_user_token');

      if (lastError) {
        localStorage.removeItem('apple_last_error');
        stopPoll();
        clearAppleAuth();
        if (mountedRef.current) {
          setConnectLoading(false);
          setNotice({ kind: 'error', text: MSG.cancelled });
        }
        return;
      }

      if (mut) {
        stopPoll();
        const res = await saveAppleConnection(mut);
        clearAppleAuth();        // token now lives server-side; drop the local copy
        if (!mountedRef.current) return;
        setConnectLoading(false);
        if (res.success && res.data?.connected) {
          setConnected(true);
          setStorefront(res.data.storefront ?? null);
          setNotice({ kind: 'success', text: MSG.connected });
        } else {
          setNotice({ kind: 'error', text: mapError(res, 'connect') });
        }
        return;
      }

      if (Date.now() - startedAt > CONNECT_TIMEOUT_MS) {
        stopPoll();
        if (mountedRef.current) {
          setConnectLoading(false);
          setNotice({ kind: 'error', text: MSG.cancelled });
        }
      }
    }, POLL_MS);
  }, [playlistId, stopPoll]);

  const disconnect = useCallback(async () => {
    stopPoll();
    await deleteAppleConnection();
    clearAppleAuth();
    if (!mountedRef.current) return;
    setConnected(false);
    setStorefront(null);
    setResult(null);
    setNotice({ kind: 'info', text: MSG.disconnected });
  }, [stopPoll]);

  const transfer = useCallback(async () => {
    if (!playlistId.trim()) return;
    setTransferLoading(true);
    setResult(null);
    setNotice({ kind: 'info', text: MSG.transferring });
    const res = await transferPlaylistToApple(playlistId.trim());
    if (!mountedRef.current) return;
    setTransferLoading(false);

    if (res.success && res.data) {
      const d = res.data;
      setResult(d);
      const added = d.tracks_added ?? 0;
      const total = d.total_tracks ?? 0;
      if (added > 0) {
        const unmatched = d.unmatched ?? 0;
        const text =
          unmatched > 0
            ? `Added ${added} of ${total} tracks to your Apple Music library. ${unmatched} weren’t available on Apple Music.`
            : `Added ${added} tracks to your Apple Music library.`;
        setNotice({ kind: 'success', text });
        onStatusChange?.('success', text, 'Apple Music');
      } else {
        setNotice({ kind: 'error', text: MSG.transferFailed });
      }
      return;
    }

    // Failure — a 401 means the stored token was cleared server-side; reflect that.
    if (res.status === 401 || (res.error || '').toLowerCase().includes('expired')) {
      setConnected(false);
    }
    setNotice({ kind: 'error', text: mapError(res, 'transfer') });
  }, [playlistId, onStatusChange]);

  return {
    playlistId,
    connected,
    storefront,
    statusLoading,
    connectLoading,
    transferLoading,
    notice,
    result,
    connect,
    disconnect,
    transfer,
    refreshStatus,
  };
}
