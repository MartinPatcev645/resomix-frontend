import React from 'react';

interface MobileExportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const MobileExportSheet: React.FC<MobileExportSheetProps> = ({ isOpen, onClose, title, subtitle, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--color-primary-background)] text-[var(--color-primary)]">
      <div className="flex items-center justify-between px-[var(--px-20)] py-[var(--px-16)] border-b border-white/10">
        <div className="flex flex-col">
          <div className="text-[length:var(--px-18)] font-helvetica">{title}</div>
          {subtitle && <div className="text-[length:var(--px-12)] font-fira opacity-70">{subtitle}</div>}
        </div>
        <button
          onClick={onClose}
          className="text-[length:var(--px-14)] font-fira opacity-80 hover:opacity-100"
          aria-label="Close"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-[var(--px-20)]">
        {children}
      </div>
    </div>
  );
};

export default MobileExportSheet;