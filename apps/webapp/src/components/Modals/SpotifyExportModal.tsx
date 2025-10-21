import React, { useEffect, useMemo, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from './BaseExportModal.tsx';

import {
  initializeSpotifyAuth,
  checkSpotifyAuthentication,
  transferPlaylistToSpotify,
  clearSpotifyAuth,
  clearGuardKey
} from '../../services/spotifyService.ts';

interface SpotifyExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
  initialPlaylistId?: string;
}

const SpotifyExportModal: React.FC<SpotifyExportModalProps> = ({
                                                                 isOpen,
                                                                 onClose,
                                                                 onStatusChange,
                                                                 initialPlaylistId
                                                               }) => {
  const defaultId = useMemo(
    () => initialPlaylistId ?? new URLSearchParams(window.location.search).get('id') ?? '',
    [initialPlaylistId]
  );

  const [playlistId, setPlaylistId] = useState(defaultId);
  const [customName, setCustomName] = useState('');

  const [isSpotifyAuthenticated, setIsSpotifyAuthenticated] = useState(false);
  const [spotifyConnectLoading, setSpotifyConnectLoading] = useState(false);
  const [spotifyTransferLoading, setSpotifyTransferLoading] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlaylistId(defaultId);
    setCustomName('');
    setIsSpotifyAuthenticated(checkSpotifyAuthentication());
  }, [isOpen, defaultId]);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const auth = checkSpotifyAuthentication();
      setIsSpotifyAuthenticated(auth);

      const lastError = localStorage.getItem('spotify_last_error');
      if (lastError) {
        setSpotifyError(lastError);
        setSpotifyConnectLoading(false);
        onStatusChange('error', lastError, 'Spotify Auth Error');
        localStorage.removeItem('spotify_last_error');
      }

      if (auth) {
        setSpotifyConnectLoading(false);
        if (!spotifyMessage) {
          setSpotifyMessage('Successfully connected to Spotify!');
          // onStatusChange('success', 'Connected to Spotify', 'Spotify Connected');
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
          setSpotifyConnectLoading(false);
          setIsSpotifyAuthenticated(true);
          setSpotifyMessage('Successfully connected to Spotify!');
          // onStatusChange('success', 'Connected to Spotify', 'Spotify Connected');
        } else if (data.error) {
          setSpotifyError(data.error);
          setSpotifyConnectLoading(false);
          onStatusChange('error', data.error, 'Spotify Auth Error');
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
      setSpotifyConnectLoading(false);
      setSpotifyTransferLoading(false);
      // setSpotifyMessage(null);
      // setSpotifyError(null);
    };
  }, [isOpen, onStatusChange]);

  const connectSpotify = async () => {
    setSpotifyError(null);
    setSpotifyMessage(null);
    try {
      setSpotifyConnectLoading(true);
      clearGuardKey(playlistId);
      await initializeSpotifyAuth(playlistId);

      const timeoutMs = 2 * 60 * 1000;
      const timer = setTimeout(() => {
        if (!checkSpotifyAuthentication()) {
          setSpotifyConnectLoading(false);
          setSpotifyError('Spotify authentication timed out. Please try again.');
          onStatusChange('error', 'Spotify authentication timed out', 'Spotify Auth Timeout');
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
      setSpotifyError(msg);
      onStatusChange('error', msg, 'Spotify Auth Error');
      setSpotifyConnectLoading(false);
    }
  };

  const disconnectSpotify = () => {
    clearSpotifyAuth();
    setIsSpotifyAuthenticated(false);
    setSpotifyMessage(null);
    setSpotifyError(null);
  };

  const doSpotifyTransfer = async () => {
    if (!playlistId.trim()) {
      setSpotifyError('Please enter a playlist ID (ResomiX UUID)');
      return;
    }
    setSpotifyTransferLoading(true);
    setSpotifyError(null);
    setSpotifyMessage(null);
    onStatusChange('loading', 'Transferring playlist to Spotify...');
    try {
      const result = await transferPlaylistToSpotify(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const msg = 'Playlist transferred to Spotify';
        setSpotifyMessage(result?.data?.spotify_playlist_url);
        onStatusChange('success', msg, 'Spotify Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to Spotify';
        setSpotifyError(errMsg);
        onStatusChange('error', errMsg, 'Spotify Transfer Failed');
        if (typeof errMsg === 'string' && (errMsg.includes('access token') || errMsg.includes('authenticate'))) {
          setIsSpotifyAuthenticated(false);
        }
      }
    } catch (err: any) {
      const msg = `Transfer failed: ${err?.message || 'Unknown error'}`;
      setSpotifyError(msg);
      onStatusChange('error', msg, 'Spotify Transfer Failed');
    } finally {
      setSpotifyTransferLoading(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Spotify"
      title="Transfer to Spotify"
      subtitle="Connect and transfer your playlist to Spotify."
    >
      <div className="w-full flex flex-col gap-[var(--px-10)] mt-[var(--px-12)]">
        <div className="flex items-center gap-[var(--px-8)] flex-wrap">
          {!isSpotifyAuthenticated ? (
            <ButtonSleek
              text={spotifyConnectLoading ? 'Connecting...' : 'Connect to Spotify'}
              onClick={connectSpotify}
              disabled={spotifyConnectLoading}
              className="cta-button primary"
              id="playlist-export-spotify-connect"
            />
          ) : (
            <>
              <ButtonSleek
                text={spotifyTransferLoading ? 'Transferring...' : 'Transfer to Spotify'}
                onClick={doSpotifyTransfer}
                disabled={spotifyTransferLoading || !playlistId.trim()}
                className="cta-button primary"
                id="playlist-export-spotify-transfer"
              />
              <ButtonSleek
                text="Disconnect"
                onClick={disconnectSpotify}
                transparent
                className="cta-button secondary"
                id="playlist-export-spotify-disconnect"
              />
            </>
          )}
        </div>

        <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
          Status: {isSpotifyAuthenticated ? 'Connected ✅' : 'Not Connected ❌'}
        </div>
        {spotifyMessage && (
          <a
            href={spotifyMessage}
            target={'_blank'}
            className="block text-sm font-light font-fira leading-tight text-green-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-full hover:text-green-300 transition-colors"
            title={spotifyMessage}
          >
            {spotifyMessage}
          </a>
        )}
        {spotifyError && (
          <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] text-red-400">
            {spotifyError}
          </div>
        )}
      </div>

      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
        <ButtonSleek text="Close" onClick={onClose} transparent className="cta-button secondary" />
      </div>
    </BaseModal>
  );
};

export default SpotifyExportModal;