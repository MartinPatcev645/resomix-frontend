import React, { useMemo } from 'react';
import SuccessSvg from '@/assets/icons/success.svg';
import BaseModal from "@/components/Modals/BaseExportModal.js";
import {useAppleTransfer} from "@resomix/hooks";
import AppleExportPanel from "@/components/Modals/Transfer/AppleExportPanel.js";

interface AppleExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
  initialPlaylistId?: string;
}

const AppleExportModal: React.FC<AppleExportModalProps> = ({
                                                             isOpen,
                                                             onClose,
                                                             onStatusChange,
                                                             initialPlaylistId,
                                                           }) => {
  // Derive default playlist id from props or URL
  const defaultId = useMemo(
    () => initialPlaylistId ?? new URLSearchParams(window.location.search).get('id') ?? '',
    [initialPlaylistId]
  );

  // Hook encapsulating Apple Music auth + transfer flow
  const s = useAppleTransfer({
    active: isOpen,
    initialPlaylistId: defaultId,
    onStatusChange,
  });

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Apple Music"
      title="Export to Apple Music"
      subtitle="Send this playlist to your Apple Music library."
    >
      {/* Close sits beside the primary action inside the panel (side by side, stacked on mobile). */}
      <AppleExportPanel
        connected={s.connected}
        storefront={s.storefront}
        statusLoading={s.statusLoading}
        connectLoading={s.connectLoading}
        transferLoading={s.transferLoading}
        ready={s.ready}
        notice={s.notice}
        log={s.log}
        hasPlaylist={!!s.playlistId?.trim()}
        onConnect={s.connect}
        onTransfer={s.transfer}
        onDisconnect={s.disconnect}
        onClose={onClose}
      />
    </BaseModal>
  );
};

export default AppleExportModal;
