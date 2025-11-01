import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  initializeAppleMusicAuth,
  checkAppleMusicAuthentication,
  transferPlaylistToAppleMusic,
  clearAppleAuth,
  clearGuardKey,
} from './appleService';

type StatusFn = (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;

interface UseAppleTransferParams {
  active: boolean;
  initialPlaylistId?: string;
  onStatusChange?: StatusFn;
}

/**
 * Hook for handling Apple Music authentication and playlist transfer
 * Mirrors the structure/behavior of useSpotifyTransfer for consistency.
 */
export function useAppleTransfer({
                                   active,
                                   initialPlaylistId,
                                   onStatusChange,
                                 }: UseAppleTransferParams) {
  // Resolve default playlist id
  const defaultId = useMemo(
    () => initialPlaylistId ?? new URLSearchParams(window.location.search).get('id') ?? '',
    [initialPlaylistId]
  );

  // Local state
  const [playlistId, setPlaylistId] = useState(defaultId);
  const [customName, setCustomName] = useState('');

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset and sync state when modal is opened
  useEffect(() => {
    if (!active) return;
    setPlaylistId(defaultId);
    setCustomName('');
    setIsAuthenticated(checkAppleMusicAuthentication());
    setMessage(null);
    setError(null);
  }, [active, defaultId]);

  // Subscribe to storage/message events to reflect auth status updates
  useEffect(() => {
    if (!active) return;

    const update = () => {
      const auth = checkAppleMusicAuthentication();
      setIsAuthenticated(auth);

      // Optional: surface last error if redirect page stored it
      const lastError = localStorage.getItem('apple_last_error');
      if (lastError) {
        setError(lastError);
        setConnectLoading(false);
        onStatusChange?.('error', lastError, 'Apple Music Auth Error');
        localStorage.removeItem('apple_last_error');
      }

      if (auth) {
        setConnectLoading(false);
        if (!message) {
          setMessage('Successfully connected to Apple Music!');
        }
      }
    };

    update();

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith('apple_')) update();
    };

    const onMessage = (e: MessageEvent) => {
      // Only trust messages from same origin
      if (e.origin !== window.location.origin) return;
      const data = e.data;
      // Expecting redirect window to post { type: 'APPLE_AUTH_RESULT', success, error? }
      if (data && data.type === 'APPLE_AUTH_RESULT') {
        if (data.success) {
          setConnectLoading(false);
          setIsAuthenticated(true);
          setMessage('Successfully connected to Apple Music!');
        } else if (data.error) {
          setError(data.error);
          setConnectLoading(false);
          onStatusChange?.('error', data.error, 'Apple Music Auth Error');
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
  }, [active, message, onStatusChange]);

  // Start Apple Music auth via redirect helper
  const connect = useCallback(async () => {
    setError(null);
    setMessage(null);
    try {
      setConnectLoading(true);
      // Prevent handling the same OAuth result multiple times for this state
      clearGuardKey(playlistId);
      await initializeAppleMusicAuth(playlistId);

      // Fallback timeout in case user closes the popup or denies access
      const timeoutMs = 2 * 60 * 1000;
      const timer = setTimeout(() => {
        if (!checkAppleMusicAuthentication()) {
          setConnectLoading(false);
          setError('Apple Music authentication timed out. Please try again.');
          onStatusChange?.('error', 'Apple Music authentication timed out', 'Apple Music Auth Timeout');
        }
      }, timeoutMs);

      // If user returns focus and auth is done, stop the timer
      const stopOnAuth = () => {
        if (checkAppleMusicAuthentication()) {
          clearTimeout(timer);
          window.removeEventListener('focus', stopOnAuth);
        }
      };
      window.addEventListener('focus', stopOnAuth);
    } catch (err: any) {
      const msg = `Failed to initialize Apple Music authentication: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Apple Music Auth Error');
      setConnectLoading(false);
    }
  }, [onStatusChange, playlistId]);

  // Clear Apple Music tokens and reset local state
  const disconnect = useCallback(() => {
    clearAppleAuth();
    setIsAuthenticated(false);
    setMessage(null);
    setError(null);
  }, []);

  // Transfer the playlist to Apple Music
  const transfer = useCallback(async () => {
    if (!playlistId.trim()) {
      setError('Please enter a playlist ID (ResomiX UUID)');
      return;
    }
    setTransferLoading(true);
    setError(null);
    setMessage(null);
    onStatusChange?.('loading', 'Transferring playlist to Apple Music...');
    try {
      const result = await transferPlaylistToAppleMusic(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const msg = 'Playlist transferred to Apple Music';
        // If backend returns a playlist URL, surface it as message
        setMessage((result?.data as any)?.apple_playlist_url ?? null);
        onStatusChange?.('success', msg, 'Apple Music Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to Apple Music';
        setError(errMsg);
        onStatusChange?.('error', errMsg, 'Apple Music Transfer Failed');
        // If token-related error, mark auth as false
        if (
          typeof errMsg === 'string' &&
          (errMsg.toLowerCase().includes('music user token') ||
            errMsg.toLowerCase().includes('developer token') ||
            errMsg.toLowerCase().includes('authenticate'))
        ) {
          setIsAuthenticated(false);
        }
      }
    } catch (err: any) {
      const msg = `Transfer failed: ${err?.message || 'Unknown error'}`;
      setError(msg);
      onStatusChange?.('error', msg, 'Apple Music Transfer Failed');
    } finally {
      setTransferLoading(false);
    }
  }, [playlistId, customName, onStatusChange]);

  return {
    playlistId,
    setPlaylistId,
    customName,
    setCustomName,
    isAuthenticated,
    connectLoading,
    transferLoading,
    message,
    error,
    connect,
    disconnect,
    transfer,
  };
}