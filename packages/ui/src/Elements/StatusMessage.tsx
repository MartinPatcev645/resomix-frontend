import React, { useEffect } from 'react'
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { SineWaves } from "../Animations/SineWaves";

const SuccessIcon = () => (
  <svg viewBox="0 0 59 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[var(--px-58)] h-[var(--px-58)]" aria-hidden="true">
    <path d="M39.7773 20L28.1107 36L20.7773 29" stroke="white" strokeWidth="0.37" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="29.7773" cy="29" r="28.815" stroke="white" strokeWidth="0.37" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 58 58" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-[var(--px-58)] h-[var(--px-58)]" aria-hidden="true">
    <rect x="19.4297" y="19.3071" width="27.5033" height="0.172978" transform="rotate(45 19.4297 19.3071)" fill="#B8B8B8" stroke="white" strokeWidth="0.172978" />
    <rect x="19.3079" y="38.7554" width="27.5033" height="0.172978" transform="rotate(-45 19.3079 38.7554)" fill="#B8B8B8" stroke="white" strokeWidth="0.172978" />
    <circle cx="29" cy="29" r="28.815" stroke="white" strokeWidth="0.37" />
  </svg>
);

type StatusType = 'loading' | 'success' | 'error';

interface AdditionalButtonProps {
    text: string
    transparent?: boolean
    onClick: () => void
    disabled?: boolean
}

interface StatusMessageProps {
    isOpen: boolean
    onClose: () => void
    status: StatusType
    title?: string
    message?: string
    additionalButton?: AdditionalButtonProps
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
    isOpen,
    onClose,
    status,
    title,
    message,
    additionalButton
}) => {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    // Close modal on escape key
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    // Loading state
    if (status === 'loading') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                {/* Backdrop with blur effect only */}
                <div
                    className="absolute inset-0 backdrop-blur-md pointer-events-auto"
                    onClick={onClose}
                />

                {/* Loading content */}
                <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-390)] w-full lg:w-[var(--px-393)] pointer-events-auto">
                    <SineWaves />
                </div>
            </div>
        )
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                {/* Backdrop with blur effect only */}
                <div
                    className="absolute inset-0 backdrop-blur-md pointer-events-auto"
                    onClick={onClose}
                />

                {/* Error content */}
                <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-390)] w-full lg:w-[var(--px-393)] pointer-events-auto">

                    <ErrorIcon />

                    <div className="text-center w-full">
                        <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                            Oops! Something<br />went wrong
                        </div>
                        <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)] text-[var(--color-neon-orange)]">
                            {message}
                        </div>
                    </div>

                    <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                        <ButtonSleek text="Close" onClick={onClose} transparent={true} />
                        {additionalButton && (
                            <ButtonSleek 
                                text={additionalButton.text} 
                                onClick={additionalButton.onClick} 
                                transparent={additionalButton.transparent}
                                disabled={additionalButton.disabled}
                            />
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // Success state (default)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Backdrop with blur effect only */}
            <div
                className="absolute inset-0 backdrop-blur-md pointer-events-auto"
                onClick={onClose}
            />

            {/* Success content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)] pointer-events-auto">

                <SuccessIcon />

                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        {title}
                    </div>
                    {message && (
                        <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                            {message}
                        </div>
                    )}
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Close" onClick={onClose} transparent={true} />
                    {additionalButton && (
                        <ButtonSleek 
                            text={additionalButton.text} 
                            onClick={additionalButton.onClick} 
                            transparent={additionalButton.transparent}
                            disabled={additionalButton.disabled}
                        />
                    )}
                </div>
            </div>
        </div>
    )
}

export default StatusMessage;
