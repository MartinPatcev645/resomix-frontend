import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  initializeSpotifyAuth,
  checkSpotifyAuthentication,
  transferPlaylistToSpotify,
  clearSpotifyAuth,
  clearGuardKey
} from './spotifyService';

type StatusFn = (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;

interface UseSpotifyTransferParams {
  active: boolean;
  initialPlaylistId?: string;
  onStatusChange?: StatusFn;
}

export function useSpotifyTransfer({ active, initialPlaylistId, onStatusChange }: UseSpotifyTransferParams) {
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

    // reset on open
  useEffect(() => {
    if (!active) return;
    setPlaylistId(defaultId);
    setCustomName('');
    setIsAuthenticated(checkSpotifyAuthentication());
    setMessage(null);
    setError(null);
  }, [active, defaultId]);

  useEffect(() => {
    if (!active) return;

    const update = () => {
      const auth = checkSpotifyAuthentication();
      setIsAuthenticated(auth);

      const lastError = localStorage.getItem('spotify_last_error');
      if (lastError) {
        setError(lastError);
        setConnectLoading(false);
        onStatusChange?.('error', lastError, 'Spotify Auth Error');
        localStorage.removeItem('spotify_last_error');
      }

      if (auth) {
        setConnectLoading(false);
        if (!message) {
          setMessage('Successfully connected to Spotify!');
        }
      }
    };

    update();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith('spotify_')) update();
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      if (data && data.type === 'SPOTIFY_AUTH_RESULT') {
        if (data.success) {
          setConnectLoading(false);
          setIsAuthenticated(true);
          setMessage('Successfully connected to Spotify!');
        } else if (data.error) {
          setError(data.error);
          setConnectLoading(false);
          onStatusChange?.('error', data.error, 'Spotify Auth Error');
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
    };
  }, [active, message, onStatusChange]);

  const connect = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      setConnectLoading(true);
      clearGuardKey(playlistId);
      await initializeSpotifyAuth(playlistId);

      const timeoutMs = 2 * 60 * 1000;
      const timer = setTimeout(() => {
        if (!checkSpotifyAuthentication()) {
          setConnectLoading(false);
          setError('Spotify authentication timed out. Please try again.');
          onStatusChange?.('error', 'Spotify authentication timed out', 'Spotify Auth Timeout');
        }
      }, timeoutMs);

      const stopOnAuth = () => {
        if (checkSpotifyAuthentication()) {
          clearTimeout(timer);
          window.removeEventListener('focus', stopOnAuth);
        }
      };
      window.addEventListener('focus', stopOnAuth);
    } catch (err: any) {
      const msg = `Failed to initialize Spotify authentication: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Spotify Auth Error');
      setConnectLoading(false);
    }
  }, [onStatusChange, playlistId]);

  const disconnect = useCallback(() => {
    clearSpotifyAuth();
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
    onStatusChange?.('loading', 'Transferring playlist to Spotify...');
    try {
      const result = await transferPlaylistToSpotify(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const msg = 'Playlist transferred to Spotify';
        setMessage(result?.data?.spotify_playlist_url ?? null);
        onStatusChange?.('success', msg, 'Spotify Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to Spotify';
        setError(errMsg);
        onStatusChange?.('error', errMsg, 'Spotify Transfer Failed');
        if (typeof errMsg === 'string' && (errMsg.includes('access token') || errMsg.includes('authenticate'))) {
          setIsAuthenticated(false);
        }
      }
    } catch (err: any) {
      const msg = `Transfer failed: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Spotify Transfer Failed');
    } finally {
      setTransferLoading(false);
    }
  }, [playlistId, customName, onStatusChange]);

  return {
      // state
    playlistId, setPlaylistId,
    customName, setCustomName,
    isAuthenticated,
    connectLoading, transferLoading,
    message, error,

      // actions
    connect, disconnect, transfer
  };
}
