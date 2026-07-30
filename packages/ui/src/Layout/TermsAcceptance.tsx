import React, { useEffect, useState } from "react";
import { Dialog } from "../Modals/Dialog";
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
        <Dialog
            isOpen
            onClose={onDismiss}
            size="sm"
            eyebrow="Account // Consent"
            title="Terms & Privacy"
            subtitle="Review and accept our privacy policy and terms of service, once accepted we'll start your playlist generation."
            ariaLabel="Terms and Privacy"
            actions={[{
                label: 'Accept Terms',
                onClick: handleAccept,
                tone: 'primary',
                disabled: !canAccept,
                id: 'terms-accept-button',
            }]}
        >

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
                                    aria-label="Resomix privacy"
                                    href="https://support.resomix.com/hc/articles/1/3/1/privacy-policy"
                                    target="_blank"
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
                                    aria-label="Resomix terms"
                                    href="https://support.resomix.com/hc/articles/1/3/11/terms-of-service"
                                    target="_blank"
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

                <div className="flex flex-col items-start gap-[var(--px-20)]">
                    <div className="font-helvetica text-[length:var(--px-11)] font-light leading-[var(--px-16)] text-[var(--rx-color-text-muted)] opacity-70">
                        Questions? Contact us at{" "}
                        <a
                            aria-label="Resomix contact"
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
        </Dialog>
    );
};
