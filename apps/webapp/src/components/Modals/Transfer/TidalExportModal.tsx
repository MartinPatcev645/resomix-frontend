import React, { useMemo } from 'react';
import { ButtonSleek } from '@resomix/ui';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from "@/components/Modals/BaseExportModal.js";
import {useTidalTransfer} from "@resomix/hooks";
import TidalExportPanel from "@/components/Modals/Transfer/TidalExportPanel.js";

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

  const t = useTidalTransfer({
    active: isOpen,
    initialPlaylistId: defaultId,
    onStatusChange
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Tidal"
      title="Transfer to Tidal"
      subtitle="Connect and transfer your playlist to Tidal."
    >
      <TidalExportPanel
        isAuthenticated={t.isAuthenticated}
        connectLoading={t.connectLoading}
        transferLoading={t.transferLoading}
        message={t.message}
        error={t.error}
        onConnect={t.connect}
        onTransfer={t.transfer}
        onDisconnect={t.disconnect}
        showFields
        playlistId={t.playlistId}
        setPlaylistId={t.setPlaylistId}
        customName={t.customName}
        setCustomName={t.setCustomName}
      />

      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
        <ButtonSleek text="Close" onClick={onClose} transparent className="cta-button secondary" />
      </div>
    </BaseModal>
  );
};

export default TidalExportModal;