import React, { useEffect, useState } from 'react';
import { ButtonSleek } from '@resomix/ui';
import { usePlaylistExport } from '@resomix/hooks';
import SuccessSvg from "@/assets/icons/success.svg";
import BaseModal from './BaseExportModal.tsx';

interface DownloadExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (status: 'loading' | 'success' | 'error', message: string, title?: string) => void;
}

const DownloadExportModal: React.FC<DownloadExportModalProps> = ({ isOpen, onClose, onStatusChange }) => {
  const { exportPlaylist, canExport } = usePlaylistExport();

  const [filename, setFilename] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [buttonText, setButtonText] = useState("Download");

  useEffect(() => {
    if (!isOpen || !canExport) return;
    let cancelled = false;
    const prepareExport = async () => {
      try {
        const result = await exportPlaylist();
        if (cancelled) return;
        if (result.success) {
          setFilename(result.filename || 'resomix_playlist.txt');
          setFileContent(result.content || '');
          setIsReady(true);
        } else if ((result as { code?: string | null }).code) {
          // A quota denial (402) already opens the global upgrade modal, with copy chosen from the
          // server's `code`. Close this one rather than leaving it open behind a second dialog
          // showing an empty file and a dead Download button.
          onClose();
        } else {
          // A real failure the global modal knows nothing about — report it here.
          onStatusChange('error', result.error || 'Failed to prepare playlist for export', 'Export Error');
        }
      } catch {
        if (!cancelled) onStatusChange('error', 'Unexpected error while preparing export', 'Export Error');
      }
    };
    prepareExport();
    return () => { cancelled = true; };
  }, [isOpen, canExport, exportPlaylist, onStatusChange, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setFilename('');
      setFileContent('');
      setIsReady(false);
      setButtonText('Download');
    }
  }, [isOpen]);

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

  const isPreparing = !isReady;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      iconSrc={SuccessSvg}
      iconAlt="Success"
      title={isPreparing ? 'Preparing ...' : 'PLAYLIST READY!'}
      subtitle="Your playlist is ready to download."
    >
      <div className="relative text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] w-full text-center my-[var(--px-8)]">
        <span>{filename || 'Preparing filename...'}</span>
      </div>

      <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] w-full text-center">
        Click download to save the playlist to your device.
      </div>
      <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
        <ButtonSleek
          text={isReady ? buttonText : 'Preparing...'}
          onClick={handleDownload}
          disabled={!isReady}
          className="cta-button primary"
          id="playlist-export-download-button"
        />
        <ButtonSleek
          text="Cancel"
          onClick={onClose}
          transparent
          className="cta-button secondary"
          id="playlist-export-cancel-button"
        />
      </div>
    </BaseModal>
  );
};

export default DownloadExportModal;