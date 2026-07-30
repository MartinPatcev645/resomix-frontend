import React, { useEffect } from "react";
import { Dialog } from "../Modals/Dialog";

interface WelcomeMessageProps {
    dropSvg: string;
    matchSvg: string;
    discoverSvg: string;
    onClose: () => void;
}

export const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ dropSvg, matchSvg, discoverSvg, onClose }) => {

    // lock body scroll while modal open
    useEffect(() => {
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = original; };
    }, []);

    return (
        <Dialog
            isOpen
            onClose={onClose}
            size="sm"
            eyebrow="Resomix // Welcome"
            title="Welcome to Resomix"
            subtitle="Discover new tracks that match your sound in seconds."
            ariaLabel="Welcome to Resomix"
            actions={[{ label: "Let's Get Started", onClick: onClose, tone: 'primary', dismiss: true, autoFocus: true }]}
        >
            <div className="flex flex-col items-start w-full gap-[var(--px-20)] pb-[var(--px-4)]">
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={dropSvg} aria-hidden="true" loading="lazy" draggable={false} alt="DropTrack" className="w-[var(--px-28)] h-[var(--px-28)]" />
                        <div className="flex flex-col items-start text-left">
                            <div className="font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)]">
                                Drop a Track
                            </div>
                            <div className="mt-[var(--px-2)] font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)] opacity-80">
                                Upload your favorite track or search from our library
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={matchSvg} aria-hidden="true" loading="lazy" draggable={false} alt="matchTrack" className="w-[var(--px-28)] h-[var(--px-28)]" />
                        <div className="flex flex-col items-start text-left">
                            <div className="font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)]">
                                Our Advanced Model Crunches Similarity
                            </div>
                            <div className="mt-[var(--px-2)] font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)] opacity-80">
                                We'll analyze the track's musical aspects
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={discoverSvg} aria-hidden="true" loading="lazy" draggable={false} alt="discoverTrack" className="w-[var(--px-32)] h-[var(--px-32)]" />
                        <div className="flex flex-col items-start text-left -ml-[var(--px-4)]">
                            <div className="font-fira text-[length:var(--px-11)] font-medium uppercase tracking-[var(--px-1)] text-[var(--rx-color-text-primary)]">
                                Discover Similar Tracks
                            </div>
                            <div className="mt-[var(--px-2)] font-helvetica text-[length:var(--px-12)] font-light leading-[var(--px-18)] text-[var(--rx-color-text-secondary)] opacity-80">
                                Get instant recommendations that match your vibe
                            </div>
                        </div>
                    </div>
            </div>
        </Dialog>
    );
};
