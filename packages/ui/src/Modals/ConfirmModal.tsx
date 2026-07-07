import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ButtonSleek } from "../Buttons/ButtonSleek";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmDanger = false,
}) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center pointer-events-none">
      {/* Backdrop with blur effect */}
      <div
        className="absolute inset-0 bg-black/10 backdrop-blur-md pointer-events-auto"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-450)] w-full mx-[var(--px-20)] pointer-events-auto">
        
        {/* Warning icon */}
        <svg viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[var(--px-58)] h-[var(--px-58)]" aria-hidden="true">
          <circle cx="29" cy="29" r="28.815" stroke="white" strokeWidth="0.37" />
          <path d="M29 20v12" stroke="white" strokeWidth="0.37" strokeLinecap="round" />
          <circle cx="29" cy="38" r="1.5" fill="white" />
        </svg>

        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            {title}
          </div>
          <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)]">
            {message}
          </div>
        </div>

        <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)] w-full">
          <button 
            onClick={onClose} 
            className="flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)] text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-[var(--px-20)] py-[var(--px-10)] border border-dotted text-[length:var(--px-11)] font-light font-helvetica uppercase tracking-wider transition-colors cursor-pointer flex justify-center items-center ${
              confirmDanger 
                ? 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white' 
                : 'border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-[var(--color-secondary)]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ConfirmModal;

