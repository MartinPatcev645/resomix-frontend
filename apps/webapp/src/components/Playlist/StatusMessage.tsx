import React, { useEffect } from 'react'
import { ButtonSleek, SineWaves } from '@resomix/ui'
import SuccessSvg from "@/assets/icons/success.svg";
import ErrorSvg from "@/assets/icons/error_cross.svg";

type StatusType = 'loading' | 'success' | 'error';

interface StatusMessageProps {
    isOpen: boolean
    onClose: () => void
    status: StatusType
    message?: string
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
    isOpen,
    onClose,
    status,
    message
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
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop with blur effect */}
                <div
                    className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Loading content */}
                <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-390)] w-full lg:w-[var(--px-393)]">
                    <SineWaves />
                </div>
            </div>
        )
    }

    // Error state
    if (status === 'error') {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Backdrop with blur effect */}
                <div
                    className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Error content */}
                <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-390)] w-full lg:w-[var(--px-393)]">

                    <img src={ErrorSvg} alt="Error" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

                    <div className="text-center w-full">
                        <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                            Oops! Something<br />went wrong
                        </div>
                        <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                            {message}
                        </div>
                    </div>

                    <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                        <ButtonSleek text="Close" onClick={onClose} transparent={true} />
                    </div>
                </div>
            </div>
        )
    }

    // Success state (default)
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop with blur effect */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Success content */}
            <div className="relative z-10 bg-[var(--color-secondary)] rounded-xs shadow-2xl px-[var(--px-50)] pb-[var(--px-50)] pt-[var(--px-30)] border border-dotted border-[var(--color-primary)] text-[var(--color-primary)] flex flex-col items-center gap-[var(--px-10)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)]">

                <img src={SuccessSvg} alt="Success" className="w-[var(--px-58)] h-[var(--px-58)] mb-[var(--px-20)]" />

                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        Changes saved!
                    </div>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] mt-[var(--px-10)]">
                        {message}
                    </div>
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Close" onClick={onClose} transparent={true} />
                </div>
            </div>
        </div>
    )
}

export default StatusMessage;
