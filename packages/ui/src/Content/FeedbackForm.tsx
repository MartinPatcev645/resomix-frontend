import React, { useEffect } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { useFeedbackStore } from "@resomix/stores";

interface FeedbackFormProps {
    onClose?: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ onClose }) => {
    const { hideFeedbackForm } = useFeedbackStore();

    // lock body scroll while modal open
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    const handleClose = () => {
        hideFeedbackForm();
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm cursor-pointer"
                onClick={handleClose}
            />

            {/* Content */}
            <div
                className="relative z-10 bg-[var(--color-primary-background)] text-[var(--color-primary)] rounded-xs shadow-2xl border border-dotted border-[var(--color-primary)] flex flex-col items-center p-[var(--px-50)] w-full lg:w-[var(--px-500)] gap-[var(--px-30)]"
            >
                <div className="text-center w-full">
                    <div className="text-[length:var(--px-19)] font-medium font-helvetica uppercase leading-[var(--px-23)]">
                        YOUR FEEDBACK
                    </div>
                </div>
                <div className="flex flex-col w-full gap-[var(--px-15)]">
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-10)] font-medium font-fira mb-[var(--px-10)]">
                            How satisfied are you with the results?
                        </div>
                        {/* Display numbers from 1 to 10 with boxes */}
                        <div className="flex items-center justify-between w-full">
                            {Array.from({ length: 10 }, (_, index) => (
                                <div key={index} className="text-[length:var(--px-10)] font-medium font-fira w-[var(--px-37)] h-[var(--px-26)] bg-[var(--color-primary-background)] border border-dotted border-[var(--color-primary)] flex items-center justify-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-secondary)]">
                                    {index + 1}
                                </div>
                            ))}
                        </div>
                        <div className="text-[length:var(--px-9)] text-[var(--color-primary-hover)] font-fira flex items-center justify-between w-full mt-[var(--px-5)]">
                            <span>Not Satisfied</span>
                            <span>Very Satisfied</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-10)] font-medium font-fira mb-[var(--px-10)]">
                            How likely are you to recommend Resomix?
                        </div>
                        {/* Display numbers from 1 to 10 with boxes */}
                        <div className="flex items-center justify-between w-full">
                            {Array.from({ length: 10 }, (_, index) => (
                                <div key={index} className="text-[length:var(--px-10)] font-medium font-fira w-[var(--px-37)] h-[var(--px-26)] bg-[var(--color-primary-background)] border border-dotted border-[var(--color-primary)] flex items-center justify-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] hover:text-[var(--color-secondary)]">
                                    {index + 1}
                                </div>
                            ))}
                        </div>
                        <div className="text-[length:var(--px-9)] text-[var(--color-primary-hover)] font-fira flex items-center justify-between w-full mt-[var(--px-5)]">
                            <span>Not Likely</span>
                            <span>Very Likely</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="text-[length:var(--px-10)] font-medium font-fira mb-[var(--px-10)]">
                            Additional feedback <span className="text-[var(--color-primary-hover)] font-light font-fira text-[length:var(--px-9)]">(optional)</span>
                        </div>
                        {/* Display Input area with same border and proper padding and text font */}
                        <textarea className="w-full p-[var(--px-10)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-medium font-fira border border-dotted border-[var(--color-primary)] rounded-xs" rows={4} placeholder="Tell us more about your experience with Resomix..." />
                    </div>
                </div>

                <div className="flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Submit" onClick={handleClose} />
                    <ButtonSleek text="Close" transparent={true} onClick={handleClose} />
                </div>
            </div>
        </div>
    );
};
