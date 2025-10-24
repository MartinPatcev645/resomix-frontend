import React, { useEffect, useState } from 'react';
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { PasswordInput } from "../Elements/PasswordInput";
import { FormInput } from "../Elements/FormInput";

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  message?: string;
  inputLabel: string;
  inputType?: 'text' | 'password';
  inputPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  minLength?: number;
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  message,
  inputLabel,
  inputType = 'text',
  inputPlaceholder,
  confirmText = "Submit",
  cancelText = "Cancel",
  required = true,
  minLength,
}) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setValue(''); // Reset value when modal opens
      setError('');
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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Validation
    if (required && !value.trim()) {
      setError(`${inputLabel} is required`);
      return;
    }
    
    if (minLength && value.length < minLength) {
      setError(`${inputLabel} must be at least ${minLength} characters`);
      return;
    }

    onSubmit(value);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-primary-background)]">
      {/* Backdrop with blur effect */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-20)] max-w-[var(--px-500)] w-full mx-[var(--px-20)]">
        
        <div className="text-center w-full">
          <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
            {title}
          </div>
          {message && (
            <div className="text-[length:var(--px-11)] font-light font-fira leading-[var(--px-15)] mt-[var(--px-10)]">
              {message}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[var(--px-20)]">
          {inputType === 'password' ? (
            <PasswordInput
              label={inputLabel}
              name="input"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              placeholder={inputPlaceholder}
              required={required}
              autoFocus
              error={error}
            />
          ) : (
            <FormInput
              label={inputLabel}
              name="input"
              type={inputType}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              placeholder={inputPlaceholder}
              required={required}
              autoFocus
              error={error}
            />
          )}

          <div className="flex justify-center items-center gap-[var(--px-10)]">
            <ButtonSleek 
              text={cancelText} 
              onClick={onClose} 
              transparent={true}
            />
            <ButtonSleek 
              text={confirmText} 
              onClick={handleSubmit}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputModal;

