import React, { useMemo } from 'react';
import MobileExportSheet from "@/components/Modals/MobileExportSheet.js";
import SpotifyExportPanel from "@/components/Modals/Transfer/SpotifyExportPanel.js";
import { useSpotifyTransfer } from '@resomix/hooks';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
  initialPlaylistId?: string;
}

const MobileSpotifyExportSheet: React.FC<Props> = ({ isOpen, onClose, onStatusChange, initialPlaylistId }) => {
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
    <MobileExportSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Export to Spotify"
      subtitle="Connect and transfer your playlist."
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
        playlistId={s.playlistId}
        setPlaylistId={s.setPlaylistId}
        customName={s.customName}
        setCustomName={s.setCustomName}
      />
    </MobileExportSheet>
  );
};

export default MobileSpotifyExportSheet;