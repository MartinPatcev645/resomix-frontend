import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAppleConnection,
  saveAppleConnection,
  deleteAppleConnection,
  transferPlaylistToApple,
  type AppleEnvelope,
  type AppleTransferResult,
} from '@resomix/api-client';
import { prepareMusicKit, type MusicKitInstance } from './appleService';

type StatusFn = (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;

export type AppleNotice = { kind: 'success' | 'error' | 'info'; text: string } | null;

interface UseAppleTransferParams {
  active: boolean;
  initialPlaylistId?: string;
  onStatusChange?: StatusFn;
}

/** User-facing copy — no raw API/Apple errors are ever shown; everything maps to these. */
const MSG = {
  connecting: 'Complete the sign-in in the Apple window…',
  connected: 'Your Apple Music account is connected.',
  authFailed:
    'Apple Music sign-in didn’t complete. Connecting requires an active Apple Music subscription.',
  prepareFailed: 'Couldn’t reach Apple Music right now. Please try again.',
  transferring: 'Adding your playlist to Apple Music…',
  sessionExpired: 'Your Apple Music session ended. Please reconnect your account.',
  transferFailed:
    'We couldn’t add this playlist to Apple Music. Make sure your Apple Music subscription is active, then try again.',
  noMatches: 'None of these tracks were available on Apple Music.',
  planBlocked: 'Apple Music export isn’t available on your plan.',
  disconnected: 'Your Apple Music account has been disconnected.',
  generic: 'Something went wrong. Please try again.',
};

/** Map a failed envelope to a standard message (never surfaces the raw server/Apple text). */
function mapError(env: AppleEnvelope<unknown>, ctx: 'connect' | 'transfer'): string {
  const status = env.status;
  const raw = (env.error || '').toLowerCase();
  if (status === 403 || env.reason === 'upgrade_required') return MSG.planBlocked;
  if (status === 401 || raw.includes('expired') || raw.includes('reconnect')) return MSG.sessionExpired;
  if (raw.includes('not connected') || raw.includes('connect your apple')) return MSG.sessionExpired;
  return ctx === 'connect' ? MSG.authFailed : MSG.transferFailed;
}

const errText = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === 'string' ? e : 'Unexpected error';

/**
 * Apple Music connection + transfer — entirely IN-PAGE (no app-owned redirect popup).
 *
 * The connection is persisted SERVER-SIDE against the user's account, so linking once survives
 * sessions and devices. MusicKit is prepared as soon as the modal opens, so the Connect click can
 * call `authorize()` on a live user gesture (browsers drop activation across awaits).
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
  const [ready, setReady] = useState(false); // MusicKit prepared → Connect is armed
  const [notice, setNotice] = useState<AppleNotice>(null);
  const [result, setResult] = useState<AppleTransferResult | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const musicRef = useRef<MusicKitInstance | null>(null);
  const mountedRef = useRef(true);

  const pushLog = useCallback((line: string) => {
    // eslint-disable-next-line no-console
    console.info('[apple]', line);
    setLog((prev) => [...prev, `${new Date().toTimeString().slice(0, 8)}  ${line}`]);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  /** Authoritative connection state from the server. */
  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    const res = await getAppleConnection();
    if (!mountedRef.current) return;
    if (res.success && res.data) {
      setConnected(!!res.data.connected);
      setStorefront(res.data.storefront ?? null);
      pushLog(res.data.connected ? `connected account found (${res.data.storefront ?? '—'})` : 'no Apple Music account linked yet');
    } else {
      setConnected(false);
      pushLog('could not read connection status');
    }
    setStatusLoading(false);
  }, [pushLog]);

  // On open: reset transient UI and load status.
  useEffect(() => {
    if (!active) return;
    setNotice(null);
    setResult(null);
    setConnectLoading(false);
    setTransferLoading(false);
    setLog([]);
    void refreshStatus();
  }, [active, refreshStatus]);

  // Prepare MusicKit up front so the Connect click can authorize on a live gesture.
  useEffect(() => {
    if (!active || connected || musicRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        pushLog('preparing Apple Music…');
        const instance = await prepareMusicKit();
        if (cancelled || !mountedRef.current) return;
        musicRef.current = instance;
        setReady(true);
        pushLog('ready to connect');
      } catch (e) {
        if (cancelled || !mountedRef.current) return;
        pushLog(`ERROR: ${errText(e)}`);
        setNotice({ kind: 'error', text: MSG.prepareFailed });
      }
    })();
    return () => { cancelled = true; };
  }, [active, connected, pushLog]);

  /** Called straight from the Connect button click — authorize() runs on the live gesture. */
  const connect = useCallback(async () => {
    const music = musicRef.current;
    if (!music) {
      setNotice({ kind: 'error', text: MSG.prepareFailed });
      return;
    }
    setConnectLoading(true);
    setNotice({ kind: 'info', text: MSG.connecting });
    pushLog('opening Apple sign-in…');
    try {
      const mut = await music.authorize(); // no await before this — gesture is still live
      if (!mut) throw new Error('authorize() returned no token');
      pushLog('authorized — saving connection');
      const res = await saveAppleConnection(mut);
      if (!mountedRef.current) return;
      if (res.success && res.data?.connected) {
        setConnected(true);
        setStorefront(res.data.storefront ?? null);
        setNotice({ kind: 'success', text: MSG.connected });
        pushLog(`connected (${res.data.storefront ?? '—'})`);
      } else {
        pushLog(`ERROR: save failed (${res.status ?? '—'})`);
        setNotice({ kind: 'error', text: mapError(res, 'connect') });
      }
    } catch (e) {
      if (!mountedRef.current) return;
      // authorize() rejects when the sign-in is dismissed or the account has no subscription.
      pushLog(`ERROR: ${errText(e)}`);
      setNotice({ kind: 'error', text: MSG.authFailed });
    } finally {
      if (mountedRef.current) setConnectLoading(false);
    }
  }, [pushLog]);

  const disconnect = useCallback(async () => {
    pushLog('disconnecting…');
    await deleteAppleConnection();
    if (!mountedRef.current) return;
    setConnected(false);
    setStorefront(null);
    setResult(null);
    setNotice({ kind: 'info', text: MSG.disconnected });
    pushLog('disconnected');
  }, [pushLog]);

  const transfer = useCallback(async () => {
    if (!playlistId.trim()) return;
    setTransferLoading(true);
    setResult(null);
    setNotice({ kind: 'info', text: MSG.transferring });
    pushLog('transferring playlist…');
    const res = await transferPlaylistToApple(playlistId.trim());
    if (!mountedRef.current) return;
    setTransferLoading(false);

    if (res.success && res.data) {
      const d = res.data;
      setResult(d);
      const added = d.tracks_added ?? 0;
      const total = d.total_tracks ?? 0;
      const unmatched = d.unmatched ?? 0;
      // What Apple CONFIRMS it holds, falling back to what it accepted when the check could not
      // run. `verified_tracks` is null for "we couldn't read it back" — deliberately not folded
      // into 0, which would report a healthy export as a failure.
      const verified = d.verified_tracks ?? null;
      const landed = verified ?? added;

      if (landed > 0) {
        const text =
          unmatched > 0
            ? `Added ${landed} of ${total} tracks to your Apple Music library. ${unmatched} weren’t available on Apple Music.`
            : `Added ${landed} tracks to your Apple Music library.`;
        setNotice({ kind: 'success', text });
        pushLog(
          verified !== null && verified < added
            ? // Apple accepted more than it kept — almost always a storefront mismatch, and the
              // only place it is visible is here.
              `done — Apple accepted ${added} but kept ${verified}/${total}, ${unmatched} unmatched`
            : `done — added ${landed}/${total}, ${unmatched} unmatched`,
        );
        onStatusChange?.('success', text, 'Apple Music');
      } else {
        const matched = d.matched ?? 0;
        pushLog(`nothing added (matched ${matched}, verified ${verified ?? 'n/a'})`);
        setNotice({
          kind: 'error',
          text:
            matched === 0
              ? MSG.noMatches
              : // The playlist exists but is empty. "Transfer failed" sends people looking for a
                // playlist that is right there, so say what actually happened.
                `The playlist was created in Apple Music, but none of the ${matched} matched tracks could be added — they may not be available in your region's catalogue.`,
        });
      }
      return;
    }

    if (res.status === 401 || (res.error || '').toLowerCase().includes('expired')) {
      setConnected(false);
      musicRef.current = null;
      setReady(false);
    }
    pushLog(`ERROR: transfer failed (${res.status ?? '—'})`);
    setNotice({ kind: 'error', text: mapError(res, 'transfer') });
  }, [playlistId, onStatusChange, pushLog]);

  return {
    playlistId,
    connected,
    storefront,
    statusLoading,
    connectLoading,
    transferLoading,
    ready,
    notice,
    result,
    log,
    connect,
    disconnect,
    transfer,
    refreshStatus,
  };
}
