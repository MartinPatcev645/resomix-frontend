import React, { useEffect, useMemo, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from './BaseExportModal.tsx';

import {
  checkTidalAuthentication,
  clearTidalAuth,
  transferPlaylistToTidal,
  initializeTidalAuth,
  clearTidalGuardKey
} from '../../services/tidalService.ts';

interface TidalExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
  initialPlaylistId?: string;
}

const TidalExportModal: React.FC<TidalExportModalProps> = ({
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

  const [isTidalAuthenticated, setIsTidalAuthenticated] = useState(false);
  const [tidalConnectLoading, setTidalConnectLoading] = useState(false);
  const [tidalTransferLoading, setTidalTransferLoading] = useState(false);
  const [tidalMessage, setTidalMessage] = useState<string | null>(null);
  const [tidalError, setTidalError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPlaylistId(defaultId);
    setCustomName('');
    setIsTidalAuthenticated(checkTidalAuthentication());
  }, [isOpen, defaultId]);

  useEffect(() => {
    if (!isOpen) return;

    const update = () => {
      const auth = checkTidalAuthentication();
      setIsTidalAuthenticated(auth);

      const lastError = localStorage.getItem('tidal_last_error');
      if (lastError) {
        setTidalError(lastError);
        setTidalConnectLoading(false);
        onStatusChange('error', lastError, 'Tidal Auth Error');
        localStorage.removeItem('tidal_last_error');
      }

      if (auth) {
        setTidalConnectLoading(false);
        if (!tidalMessage) {
          setTidalMessage('Successfully connected to TIDAL!');
        }
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
          setTidalConnectLoading(false);
          setIsTidalAuthenticated(true);
          setTidalMessage('Successfully connected to TIDAL!');
        } else if (data.error) {
          setTidalError(data.error);
          setTidalConnectLoading(false);
          onStatusChange('error', data.error, 'Tidal Auth Error');
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
      setTidalConnectLoading(false);
      setTidalTransferLoading(false);
      // setTidalMessage(null);
      // setTidalError(null);

    };
  }, [isOpen, onStatusChange, tidalMessage]);

  const connectTidal = async () => {
    setTidalError(null);
    setTidalMessage(null);
    try {
      setTidalConnectLoading(true);
      clearTidalGuardKey(playlistId);
      await initializeTidalAuth(playlistId);

      const timeoutMs = 2 * 60 * 1000;
      const timer = setTimeout(() => {
        if (!checkTidalAuthentication()) {
          setTidalConnectLoading(false);
          setTidalError('TIDAL authentication timed out. Please try again.');
          onStatusChange('error', 'TIDAL authentication timed out', 'Tidal Auth Timeout');
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
    onStatusChange('loading', 'Transferring playlist to TIDAL...');
    try {
      const result = await transferPlaylistToTidal(playlistId.trim(), customName.trim() || null);
      if (result?.success) {
        const msg = String(result.message) || 'Playlist transferred to TIDAL';
        setTidalMessage(msg);
        onStatusChange('success', msg, 'Tidal Transfer');
      } else {
        const errMsg = result?.error || 'Failed to transfer playlist to TIDAL';
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

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Tidal"
      title="Transfer to Tidal"
      subtitle="Connect and transfer your playlist to Tidal."
    >
      <div className="w-full flex flex-col gap-[var(--px-10)] mt-[var(--px-12)]">
        <div className="flex items-center gap-[var(--px-8)] flex-wrap">
          {!isTidalAuthenticated ? (
            <ButtonSleek
              text={tidalConnectLoading ? 'Connecting...' : 'Connect to TIDAL'}
              onClick={connectTidal}
              disabled={tidalConnectLoading}
              className="cta-button primary"
              id="playlist-export-tidal-connect"
            />
          ) : (
            <>
              <ButtonSleek
                text={tidalTransferLoading ? 'Transferring...' : 'Transfer to TIDAL'}
                onClick={doTidalTransfer}
                disabled={tidalTransferLoading || !playlistId.trim()}
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

      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
        <ButtonSleek text="Close" onClick={onClose} transparent className="cta-button secondary" />
      </div>
    </BaseModal>
  );
};

export default TidalExportModal;