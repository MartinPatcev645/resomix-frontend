import React, { useEffect, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import { usePlaylistExport } from '@resomix/hooks';
import SuccessSvg from "@/assets/icons/success.svg";
import BrakesSvg from "@/assets/icons/brakes.svg";

// Spotify/Tidal services
import {
  initializeSpotifyAuth,
  handleSpotifyCallback,
  checkSpotifyAuthentication,
  transferPlaylistToSpotify,
  clearSpotifyAuth
} from '../../services/spotifyService.ts';

import {
  initializeTidalAuth,
  handleTidalCallback,
  checkTidalAuthentication,
  clearTidalAuth
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
  const [playlistId, setPlaylistId] = useState('');
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

  // Prepare export when modal opens; render the modal immediately with "Preparing ..." title.
  // Do not trigger global success popup when preparation finishes; only update state locally.
  useEffect(() => {
    const prepareExport = async () => {
      if (!isOpen || !canExport) return;

      try {
        const result = await exportPlaylist();
        if (result.success) {
          setFilename(result.filename || 'resomix_playlist.txt');
          setFileContent(result.content || '');
          setIsReady(true); // Unblocks actions and flips title to "PLAYLIST READY!"
        } else {
          onStatusChange('error', result.error || 'Failed to prepare playlist for export', 'Export Error');
        }
      } catch (error) {
        onStatusChange('error', 'Unexpected error while preparing export', 'Export Error');
      }
    };

    prepareExport();
  }, [isOpen, canExport, exportPlaylist, onStatusChange]);

  // Body scroll lock and reset state on close/unmount
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      // Reset state on unmount or close
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

  // Close on Escape key
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

  // Check auth status on mount/open
  useEffect(() => {
    if (!isOpen) return;
    setIsSpotifyAuthenticated(checkSpotifyAuthentication());
    setIsTidalAuthenticated(checkTidalAuthentication());
  }, [isOpen]);

  // Handle OAuth callbacks for Spotify and Tidal
  useEffect(() => {
    if (!isOpen) return;

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (!code && !state && !error) return;

    const spotifyState = localStorage.getItem('spotify_auth_state');
    const tidalState = localStorage.getItem('tidal_oauth_state');

    if (error) {
      if (state === tidalState) {
        setTidalError(`Tidal authorization failed: ${error}`);
      } else if (state === spotifyState) {
        setSpotifyError(`Spotify authorization failed: ${error}`);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && state) {
      // Tidal callback
      if (state === tidalState) {
        setTidalError(null);
        setTidalConnectLoading(true);
        handleTidalCallback(code, state)
          .then((res: any) => {
            if (res?.success) {
              setIsTidalAuthenticated(true);
              setTidalMessage('Successfully connected to Tidal!');
              onStatusChange('success', 'Connected to Tidal');
            } else {
              const msg = res?.error || 'Failed to connect to Tidal';
              setTidalError(msg);
              onStatusChange('error', msg, 'Tidal Connect Failed');
            }
          })
          .finally(() => {
            setTidalConnectLoading(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          });
        return;
      }

      // Spotify callback
      if (state === spotifyState) {
        setSpotifyError(null);
        setSpotifyConnectLoading(true);
        handleSpotifyCallback(code, state)
          .then((res: any) => {
            if (res?.success) {
              setIsSpotifyAuthenticated(true);
              setSpotifyMessage('Successfully connected to Spotify!');
              onStatusChange('success', 'Connected to Spotify');
            } else {
              const msg = res?.error || 'Failed to connect to Spotify';
              setSpotifyError(msg);
              onStatusChange('error', msg, 'Spotify Connect Failed');
            }
          })
          .finally(() => {
            setSpotifyConnectLoading(false);
            window.history.replaceState({}, document.title, window.location.pathname);
          });
      }
    }
  }, [isOpen, onStatusChange]);

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
      await initializeSpotifyAuth();
    } catch (err: any) {
      const msg = `Failed to initialize Spotify authentication: ${err?.message || 'Unknown error'}`;
      setSpotifyError(msg);
      onStatusChange('error', msg, 'Spotify Auth Error');
    } finally {
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
        const msg = result.message || 'Playlist transferred to Spotify';
        setSpotifyMessage(msg);
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

  // Tidal actions
  const connectTidal = async () => {
    setTidalError(null);
    setTidalMessage(null);
    try {
      setTidalConnectLoading(true);
      await initializeTidalAuth();
    } catch (err: any) {
      const msg = `Failed to initialize Tidal authentication: ${err?.message || 'Unknown error'}`;
      setTidalError(msg);
      onStatusChange('error', msg, 'Tidal Auth Error');
    } finally {
      setTidalConnectLoading(false);
    }
  };

  const disconnectTidal = () => {
    clearTidalAuth();
    setIsTidalAuthenticated(false);
    setTidalMessage(null);
    setTidalError(null);
  };

  // Note: assuming backend uses stored session tokens (no need to pass access token here)
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
      // Your Test component used `transferPlaylistToTidal(playlistId, playlistName?)`
      // Keep the same signature
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { transferPlaylistToTidal } = require('../services/api');
      const result = await transferPlaylistToTidal(playlistId.trim(), customName.trim() || null);

      if (result?.success) {
        const msg = result.message || 'Playlist transferred to Tidal';
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
      <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">
        {/* Header */}
        <img
          src={SuccessSvg}
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          alt="Success"
          className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]"
        />
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
          <img
            src={BrakesSvg}
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            alt="Brakes"
            className="absolute top-0 left-0 pointer-events-none"
          />
          <span>{filename || 'Preparing filename...'}</span>
        </div>

        {/* Integrations moved to the top of the modal */}
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

          {/* Status */}
          <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)]">
            Status: {isSpotifyAuthenticated ? 'Connected ✅' : 'Not Connected ❌'}
          </div>
          {spotifyMessage && (
            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] text-green-400">
              {spotifyMessage}
            </div>
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

          {/* Status */}
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

        {/* Shared inputs for transfers */}
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

        {/* Download section */}
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