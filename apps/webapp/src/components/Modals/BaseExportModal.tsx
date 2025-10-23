import React, { useEffect } from 'react';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;

  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  iconSrc?: string;
  iconAlt?: string;
  header?: React.ReactNode;

  containerClassName?: string;
  contentClassName?: string;
}
const BaseExportModal: React.FC<BaseModalProps> = ({
                                               isOpen,
                                               onClose,
                                               children,
                                               title,
                                               subtitle,
                                               iconSrc,
                                               iconAlt,
                                               header,
                                               containerClassName,
                                               contentClassName
                                             }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderHeader = () => {
    if (header) return header;
    if (!iconSrc && !title && !subtitle) return null;
    return (
      <>
        {iconSrc ? (
          <img
            src={iconSrc}
            aria-hidden="true"
            loading="lazy"
            draggable={false}
            alt={iconAlt || 'Modal'}
            className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]"
          />
        ) : null}
        {(title || subtitle) && (
          <div className="text-center w-full">
            {title ? (
              <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                {title}
              </div>
            ) : null}
            {subtitle ? (
              <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                {subtitle}
              </div>
            ) : null}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm modal-backdrop"
        onClick={onClose}
      />
      <div
        className={`relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-800)] w-full lg:w-[var(--px-600)] ${containerClassName || ''}`}
      >
        {renderHeader()}
        <div className={`w-full ${contentClassName || ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default BaseExportModal;
