import React, { useEffect, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import { usePlaylistExport } from '@resomix/hooks';

// Spotify services
import {
  initializeSpotifyAuth,
  checkSpotifyAuthentication,
  transferPlaylistToSpotify,
  clearSpotifyAuth,
  clearGuardKey
} from '../../services/spotifyService.ts';

// Tidal services (без initializeTidalAuth)
import {
  checkTidalAuthentication,
  clearTidalAuth,
  transferPlaylistToTidal,
  initializeTidalAuth
} from '../../services/tidalService.ts';

interface PlaylistExportWithIntegrationsProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
}

const PlaylistExportWithIntegrations: React.FC<PlaylistExportWithIntegrationsProps> = ({
                                                                                         isOpen,
                                                                                         onClose,
                                                                                         onStatusChange,
                                                                                       }) => {
  // Download (existing)
  const { exportPlaylist, canExport } = usePlaylistExport();
  const [filename, setFilename] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [buttonText, setButtonText] = useState("Download");

  // Shared playlist info for streaming transfers
  const [playlistId, setPlaylistId] = useState(new URLSearchParams(window.location.search).get('id') || '');
  const [customName, setCustomName] = useState('');

  // Spotify states
  const [isSpotifyAuthenticated, setIsSpotifyAuthenticated] = useState(false);
  const [spotifyConnectLoading, setSpotifyConnectLoading] = useState(false);
  const [spotifyTransferLoading, setSpotifyTransferLoading] = useState(false);
  const [spotifyMessage, setSpotifyMessage] = useState<string | null>(null);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);

  // Tidal states
  const [isTidalAuthenticated, setIsTidalAuthenticated] = useState(false);
  const [tidalConnectLoading, setTidalConnectLoading] = useState(false);
  const [tidalTransferLoading, setTidalTransferLoading] = useState(false);
  const [tidalMessage, setTidalMessage] = useState<string | null>(null);
  const [tidalError, setTidalError] = useState<string | null>(null);

  useEffect(() => {
    const prepareExport = async () => {
      if (!isOpen || !canExport) return;
      try {
        const result = await exportPlaylist();
        if (result.success) {
          setFilename(result.filename || 'resomix_playlist.txt');
          setFileContent(result.content || '');
          setIsReady(true);
        } else {
          onStatusChange('error', result.error || 'Failed to prepare playlist for export', 'Export Error');
        }
      } catch {
        onStatusChange('error', 'Unexpected error while preparing export', 'Export Error');
      }
    };
    prepareExport();
  }, [isOpen, canExport, exportPlaylist, onStatusChange]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      setFilename('');
      setFileContent('');
      setIsReady(false);
      setButtonText("Download");
      setSpotifyMessage(null);
      setSpotifyError(null);
      setTidalMessage(null);
      setTidalError(null);
      setSpotifyConnectLoading(false);
      setTidalConnectLoading(false);
      setSpotifyTransferLoading(false);
      setTidalTransferLoading(false);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setIsSpotifyAuthenticated(checkSpotifyAuthentication());
    setIsTidalAuthenticated(checkTidalAuthentication());
  }, [isOpen]);

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
          onStatusChange('success', 'Connected to Spotify', 'Spotify Connected');
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
          onStatusChange('success', 'Connected to Spotify', 'Spotify Connected');
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
    };
  }, [isOpen, onStatusChange, spotifyMessage]);

  // Download handler
  const handleDownload = () => {
    if (!fileContent || !filename) return;
    try {
      const blob = new Blob([fileContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setButtonText("Downloaded!");
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      console.error('Failed to download file:', err);
      onStatusChange('error', 'Failed to download playlist file', 'Download Failed');
    }
  };

  // Spotify actions
  const connectSpotify = async () => {
    setSpotifyError(null);
    setSpotifyMessage(null);
    try {
      setSpotifyConnectLoading(true);
      clearGuardKey(playlistId);
      await initializeSpotifyAuth(playlistId);

      const timeoutMs = 200 * 60 * 1000;
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
      console.log('---spotify result', result);
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

  const connectTidal = async () => {
    setTidalError(null);
    setTidalMessage(null);
    try {
      setTidalConnectLoading(true);

      await initializeTidalAuth(playlistId);
    } catch (err: any) {
      const msg = `Failed to initialize Tidal authentication: ${err?.message || 'Unknown error'}`;
      setTidalError(msg);
      onStatusChange('error', msg, 'Tidal Auth Error');
      setTidalConnectLoading(false);
    }
  };

  const disconnectTidal = () => {
    clearTidalAuth();
    setIsTidalAuthenticated(false);
    setTidalMessage(null);
    setTidalError(null);
  };

  const doTidalTransfer = async () => {
    if (!playlistId.trim()) {
      setTidalError('Please enter a playlist ID (ResomiX UUID)');
      return;
    }
    setTidalTransferLoading(true);
    setTidalError(null);
    setTidalMessage(null);
    onStatusChange('loading', 'Transferring playlist to Tidal...');
    try {
      const result = await transferPlaylistToTidal(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const msg = String(result.message) || 'Playlist transferred to Tidal';
        setTidalMessage(msg);
        onStatusChange('success', msg, 'Tidal Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to Tidal';
        setTidalError(errMsg);
        onStatusChange('error', errMsg, 'Tidal Transfer Failed');
        if (typeof errMsg === 'string' && (errMsg.includes('access token') || errMsg.includes('authenticate'))) {
          setIsTidalAuthenticated(false);
        }
      }
    } catch (err: any) {
      const msg = `Transfer failed: ${err?.message || 'Unknown error'}`;
      setTidalError(msg);
      onStatusChange('error', msg, 'Tidal Transfer Failed');
    } finally {
      setTidalTransferLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPreparing = !isReady;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
        onClick={onClose}
        id="playlist-export-backdrop"
      />

      {/* Modal */}
      <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-800)] w-full lg:w-[var(--px-600)]">
        {/* Header */}
        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            {isPreparing ? 'Preparing ...' : 'PLAYLIST READY!'}
          </div>
          <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
            Your playlist is ready to download or transfer to your streaming services.
          </div>
        </div>

        {/* Filename indicator */}
        <div className="relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center my-[var(--px-8)]">
          <span>{filename || 'Preparing filename...'}</span>
        </div>

        {/* Spotify section */}
        <div className="w-full border border-dotted border-[var(--color-primary)] rounded-xs p-[var(--px-12)] flex flex-col gap-[var(--px-10)]">
          <div className="text-[length:var(--px-12)] font-semibold font-helvetica uppercase">
            Spotify
          </div>

          <div className="flex items-center gap-[var(--px-8)] flex-wrap">
            {!isSpotifyAuthenticated ? (
              <ButtonSleek
                text={spotifyConnectLoading ? 'Connecting...' : 'Connect to Spotify'}
                onClick={connectSpotify}
                disabled={isPreparing || spotifyConnectLoading}
                className="cta-button primary"
                id="playlist-export-spotify-connect"
              />
            ) : (
              <>
                <ButtonSleek
                  text={spotifyTransferLoading ? 'Transferring...' : 'Transfer to Spotify'}
                  onClick={doSpotifyTransfer}
                  disabled={isPreparing || spotifyTransferLoading || !playlistId.trim()}
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

        {/* Tidal section */}
        <div className="w-full border border-dotted border-[var(--color-primary)] rounded-xs p-[var(--px-12)] flex flex-col gap-[var(--px-10)]">
          <div className="text-[length:var(--px-12)] font-semibold font-helvetica uppercase">
            Tidal
          </div>

          <div className="flex items-center gap-[var(--px-8)] flex-wrap">
            {!isTidalAuthenticated ? (
              <ButtonSleek
                text={tidalConnectLoading ? 'Connecting...' : 'Connect to Tidal'}
                onClick={connectTidal}
                disabled={isPreparing || tidalConnectLoading}
                className="cta-button primary"
                id="playlist-export-tidal-connect"
              />
            ) : (
              <>
                <ButtonSleek
                  text={tidalTransferLoading ? 'Transferring...' : 'Transfer to Tidal'}
                  onClick={doTidalTransfer}
                  disabled={isPreparing || tidalTransferLoading || !playlistId.trim()}
                  className="cta-button primary"
                  id="playlist-export-tidal-transfer"
                />
                <ButtonSleek
                  text="Disconnect"
                  onClick={disconnectTidal}
                  transparent
                  className="cta-button secondary"
                  id="playlist-export-tidal-disconnect"
                />
              </>
            )}
          </div>

          <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
            Status: {isTidalAuthenticated ? 'Connected ✅' : 'Not Connected ❌'}
          </div>
          {tidalMessage && (
            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] text-green-400">
              {tidalMessage}
            </div>
          )}
          {tidalError && (
            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] text-red-400">
              {tidalError}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-[var(--color-primary)]/30 my-[var(--px-20)]" />

        {/* Shared inputs */}
        <div className="w-full grid gap-[var(--px-10)] mt-[var(--px-10)]">
          <label className="flex flex-col gap-[var(--px-6)]">
            <span className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
              ResomiX Playlist UUID
            </span>
            <input
              type="text"
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              placeholder="e.g. 7b821bef-e168-4511-8525-5e1664b7e483"
              className="bg-transparent border border-dotted border-[var(--color-primary)] rounded-xs px-[var(--px-10)] py-[var(--px-8)] text-[var(--color-primary)] outline-none"
            />
          </label>

          <label className="flex flex-col gap-[var(--px-6)]">
            <span className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
              Custom Playlist Name (optional)
            </span>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Leave empty to use default title"
              className="bg-transparent border border-dotted border-[var(--color-primary)] rounded-xs px-[var(--px-10)] py-[var(--px-8)] text-[var(--color-primary)] outline-none"
            />
          </label>
        </div>

        {/* Download */}
        <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
          Click download to save the playlist to your device, or connect to Spotify/Tidal above to transfer it.
        </div>
        <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
          <ButtonSleek
            text={isReady ? buttonText : "Preparing..."}
            onClick={handleDownload}
            disabled={!isReady}
            className="cta-button primary"
            id="playlist-export-download-button"
          />
          <ButtonSleek
            text="Cancel"
            onClick={onClose}
            transparent={true}
            className="cta-button secondary"
            id="playlist-export-cancel-button"
          />
        </div>
      </div>
    </div>
  );
};

export default PlaylistExportWithIntegrations;