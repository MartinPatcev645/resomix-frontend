import React, { useMemo } from 'react';
import { ButtonSleek } from '@resomix/ui';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from './BaseExportModal.tsx';
import { useSpotifyTransfer} from "@/hooks/useSpotifyTransfer.ts";
import SpotifyExportPanel from "./SpotifyExportPanel.tsx";

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

  const s = useSpotifyTransfer({
    active: isOpen,
    initialPlaylistId: defaultId,
    onStatusChange
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Spotify"
      title="Transfer to Spotify"
      subtitle="Connect and transfer your playlist to Spotify."
    >
      <SpotifyExportPanel
        isAuthenticated={s.isAuthenticated}
        connectLoading={s.connectLoading}
        transferLoading={s.transferLoading}
        message={s.message}
        error={s.error}
        onConnect={s.connect}
        onTransfer={s.transfer}
        onDisconnect={s.disconnect}
        // при необходимости можно включить поля:
        // showFields
        playlistId={s.playlistId}
        setPlaylistId={s.setPlaylistId}
        customName={s.customName}
        setCustomName={s.setCustomName}
      />

      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
        <ButtonSleek text="Close" onClick={onClose} transparent className="cta-button secondary" />
      </div>
    </BaseModal>
  );
};

export default SpotifyExportModal;