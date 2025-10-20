import React, { useEffect, useMemo, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from './BaseExportModal.tsx';

import {
  checkTidalAuthentication,
  clearTidalAuth,
  transferPlaylistToTidal,
  initializeTidalAuth
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

  useEffect(() => {
    if (!isOpen) return;
    return () => {
      setTidalConnectLoading(false);
      setTidalTransferLoading(false);
      setTidalMessage(null);
      setTidalError(null);
    };
  }, [isOpen]);

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
              text={tidalConnectLoading ? 'Connecting...' : 'Connect to Tidal'}
              onClick={connectTidal}
              disabled={tidalConnectLoading}
              className="cta-button primary"
              id="playlist-export-tidal-connect"
            />
          ) : (
            <>
              <ButtonSleek
                text={tidalTransferLoading ? 'Transferring...' : 'Transfer to Tidal'}
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