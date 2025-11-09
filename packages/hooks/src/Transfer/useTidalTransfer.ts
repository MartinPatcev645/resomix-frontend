import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkTidalAuthentication,
  clearTidalAuth,
  transferPlaylistToTidal,
  initializeTidalAuth,
  clearTidalGuardKey
} from './tidalService';

type StatusFn = (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;

interface UseTidalTransferParams {
  active: boolean;
  initialPlaylistId?: string;
  onStatusChange?: StatusFn;
}

export function useTidalTransfer({ active, initialPlaylistId, onStatusChange }: UseTidalTransferParams) {
  const defaultId = useMemo(
    () => initialPlaylistId ?? new URLSearchParams(window.location.search).get('id') ?? '',
    [initialPlaylistId]
  );

  const [playlistId, setPlaylistId] = useState(defaultId);
  const [customName, setCustomName] = useState('');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    setPlaylistId(defaultId);
    setCustomName('');
    setIsAuthenticated(checkTidalAuthentication());
    setMessage(null);
    setError(null);
  }, [active, defaultId]);

  useEffect(() => {
    if (!active) return;

    const update = () => {
      const auth = checkTidalAuthentication();
      setIsAuthenticated(auth);

      const lastError = localStorage.getItem('tidal_last_error');
      if (lastError) {
        setError(lastError);
        setConnectLoading(false);
        onStatusChange?.('error', lastError, 'Tidal Auth Error');
        localStorage.removeItem('tidal_last_error');
      }

      if (auth) {
        setConnectLoading(false);
      }
    };

    update();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith('tidal_')) update();
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (data && data.type === 'TIDAL_AUTH_RESULT') {
        if (data.success) {
          setConnectLoading(false);
          setIsAuthenticated(true);
        } else if (data.error) {
          setError(data.error);
          setConnectLoading(false);
          onStatusChange?.('error', data.error, 'Tidal Auth Error');
        }
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('message', onMessage);
    const interval = setInterval(update, 2000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
      setConnectLoading(false);
      setTransferLoading(false);
    };
  }, [active, onStatusChange]);

  const connect = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      setConnectLoading(true);
      clearTidalGuardKey(playlistId);
      await initializeTidalAuth(playlistId);

      const timeoutMs = 2 * 60 * 1000;
      const timer = setTimeout(() => {
        if (!checkTidalAuthentication()) {
          setConnectLoading(false);
          setError('TIDAL authentication timed out. Please try again.');
          onStatusChange?.('error', 'TIDAL authentication timed out', 'Tidal Auth Timeout');
        }
      }, timeoutMs);

      const stopOnAuth = () => {
        if (checkTidalAuthentication()) {
          clearTimeout(timer);
          window.removeEventListener('focus', stopOnAuth);
        }
      };
      window.addEventListener('focus', stopOnAuth);
    } catch (err: any) {
      const msg = `Failed to initialize TIDAL authentication: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Tidal Auth Error');
      setConnectLoading(false);
    }
  }, [onStatusChange, playlistId]);

  const disconnect = useCallback(() => {
    clearTidalAuth();
    setIsAuthenticated(false);
    setMessage(null);
    setError(null);
  }, []);

  const transfer = useCallback(async () => {
    if (!playlistId.trim()) {
      setError('Please enter a playlist ID (ResomiX UUID)');
      return;
    }
    setTransferLoading(true);
    setError(null);
    setMessage(null);
    onStatusChange?.('loading', 'Transferring playlist to TIDAL...');
    try {
      const result = await transferPlaylistToTidal(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const url =
          (result.data as any)?.tidal_playlist_url ??
          (result.data as any)?.url ??
          null;

        if (url) setMessage(url);

        onStatusChange?.('success', 'Playlist transferred to TIDAL', 'Tidal Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to TIDAL';
        setError(errMsg);
        onStatusChange?.('error', errMsg, 'Tidal Transfer Failed');
        if (typeof errMsg === 'string' && (errMsg.includes('access token') || errMsg.includes('authenticate'))) {
          setIsAuthenticated(false);
        }
      }
    } catch (err: any) {
      const msg = `Transfer failed: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Tidal Transfer Failed');
    } finally {
      setTransferLoading(false);
    }
  }, [playlistId, customName, onStatusChange]);

  return {
    playlistId, setPlaylistId,
    customName, setCustomName,
    isAuthenticated,
    connectLoading, transferLoading,
    message, error,

    connect, disconnect, transfer
  };
}