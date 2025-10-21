import React, { useMemo } from 'react';
import MobileExportSheet from "@/components/Modals/MobileExportSheet.js";
import TidalExportPanel from './TidalExportPanel.tsx';
import { useTidalTransfer } from '../../hooks/useTidalTransfer.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
  initialPlaylistId?: string;
}

const MobileTidalExportSheet: React.FC<Props> = ({ isOpen, onClose, onStatusChange, initialPlaylistId }) => {
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
    <MobileExportSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Export to TIDAL"
      subtitle="Connect and transfer your playlist."
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
        playlistId={t.playlistId}
        setPlaylistId={t.setPlaylistId}
        customName={t.customName}
        setCustomName={t.setCustomName}
      />
    </MobileExportSheet>
  );
};

export default MobileTidalExportSheet;