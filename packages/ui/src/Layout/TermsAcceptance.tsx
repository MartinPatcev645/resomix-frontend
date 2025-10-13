import React, { useEffect, useState } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";
import { BASE_LANDING_URL, BASE_BETA_URL } from "@resomix/config";

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
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80 mt-[var(--px-10)]">
                        Review and accept our privacy policy and terms of service, once accepted we'll start your playlist generation.
                    </div>
                </div>

                <div className="flex flex-col items-start w-full gap-[var(--px-20)]">
                    <div className="flex items-start gap-[var(--px-12)] w-full min-h-[var(--px-60)]">
                        <div className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] mt-[var(--px-2)]">
                            <input
                                type="checkbox"
                                id="privacy-checkbox"
                                checked={privacyChecked}
                                onChange={(e) => setPrivacyChecked(e.target.checked)}
                                className="w-full h-full accent-[var(--color-secondary-background)] cursor-pointer"
                            />
                        </div>
                        <label htmlFor="privacy-checkbox" className="flex flex-col items-start text-left cursor-pointer flex-1">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-90 uppercase">
                                Privacy Policy
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                I agree to Resomix's{" "}
                                <a 
                                    href={`${BASE_LANDING_URL}/privacy`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="underline hover:font-normal footer-link"
                                    onClick={(e) => e.stopPropagation()}
                                    id="terms-privacy-link"
                                >
                                    Privacy Policy
                                </a>
                                {" "}and understand that uploaded files are automatically deleted after 24 hours
                            </div>
                        </label>
                    </div>

                    <div className="flex items-start gap-[var(--px-12)] w-full min-h-[var(--px-60)]">
                        <div className="flex-shrink-0 w-[var(--px-16)] h-[var(--px-16)] mt-[var(--px-2)]">
                            <input
                                type="checkbox"
                                id="contact-checkbox"
                                checked={contactChecked}
                                onChange={(e) => setContactChecked(e.target.checked)}
                                className="w-full h-full accent-[var(--color-secondary-background)] cursor-pointer"
                            />
                        </div>
                        <label htmlFor="contact-checkbox" className="flex flex-col items-start text-left cursor-pointer flex-1">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-90 uppercase">
                                Terms of Service
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                I agree to Resomix's{" "}
                                <a 
                                    href={`${BASE_LANDING_URL}/terms`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="underline hover:font-normal footer-link"
                                    onClick={(e) => e.stopPropagation()}
                                    id="terms-terms-link"
                                >
                                    Terms of Service
                                </a>
                                {" "}
                            </div>
                        </label>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-[var(--px-20)]">
                    <ButtonSleek 
                        text="Accept Terms" 
                        onClick={handleAccept}
                        disabled={!canAccept}
                        className="cta-button primary"
                        id="terms-accept-button"
                    />
                    <div className="text-[length:var(--px-9)] font-light font-fira leading-[var(--px-12)] opacity-60 text-center">
                        Questions? Contact us at{" "}
                        <a 
                            href={`${BASE_BETA_URL}/contact`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="underline hover:font-normal footer-link"
                            onClick={(e) => e.stopPropagation()}
                            id="terms-contact-link"
                        >
                            resomix.com/contact
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};
