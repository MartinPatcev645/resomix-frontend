import React, { useEffect, useState } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";

interface TermsAcceptanceProps {
    onAccept: () => void;
    onDismiss: () => void;
}

export const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({ onAccept, onDismiss }) => {
    const [privacyChecked, setPrivacyChecked] = useState(false);
    const [contactChecked, setContactChecked] = useState(false);

    const canAccept = privacyChecked && contactChecked;

    // lock body scroll while modal open
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    const handleAccept = () => {
        if (canAccept) {
            onAccept();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm cursor-pointer"
                onClick={onDismiss}
            />

            {/* Content */}
            <div
                className="relative z-10 bg-[var(--color-primary-background)] text-[var(--color-primary)] rounded-xs shadow-2xl border border-dotted border-[var(--color-primary)] flex flex-col items-center p-[var(--px-30)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)] gap-[var(--px-30)]"
            >
                <div className="text-center w-full">
                    <div className="text-[length:var(--px-22)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        Terms & Privacy
                    </div>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                        Please accept our terms to continue using Resomix.
                    </div>
                </div>

                <div className="flex flex-col items-start w-full gap-[var(--px-20)]">
                    <div className="flex items-start gap-[var(--px-12)] w-full">
                        <input
                            type="checkbox"
                            id="privacy-checkbox"
                            checked={privacyChecked}
                            onChange={(e) => setPrivacyChecked(e.target.checked)}
                            className="mt-[var(--px-2)] w-[var(--px-16)] h-[var(--px-16)] accent-[var(--color-primary)] cursor-pointer"
                        />
                        <label htmlFor="privacy-checkbox" className="flex flex-col items-start text-left cursor-pointer">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-80 uppercase">
                                Privacy Policy
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                I agree to the privacy policy and data handling terms
                            </div>
                        </label>
                    </div>

                    <div className="flex items-start gap-[var(--px-12)] w-full">
                        <input
                            type="checkbox"
                            id="contact-checkbox"
                            checked={contactChecked}
                            onChange={(e) => setContactChecked(e.target.checked)}
                            className="mt-[var(--px-2)] w-[var(--px-16)] h-[var(--px-16)] accent-[var(--color-primary)] cursor-pointer"
                        />
                        <label htmlFor="contact-checkbox" className="flex flex-col items-start text-left cursor-pointer">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-80 uppercase">
                                Contact Terms
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                I agree to receive service-related communications
                            </div>
                        </label>
                    </div>
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek 
                        text="Accept Terms" 
                        onClick={handleAccept}
                        disabled={!canAccept}
                    />
                </div>
            </div>
        </div>
    );
};
