import React, { useEffect } from "react";
import { ButtonSleek } from "../Buttons/ButtonSleek";

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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/20 backdrop-blur-sm cursor-pointer"
                onClick={onClose}
            />

            {/* Content */}
            <div
                className="relative z-10 bg-[var(--color-primary-background)] text-[var(--color-primary)] rounded-xs shadow-2xl border border-dotted border-[var(--color-primary)] flex flex-col items-center p-[var(--px-30)] max-w-[var(--px-400)] w-full lg:w-[var(--px-393)] gap-[var(--px-30)]"
            >
                <div className="text-center w-full">
                    <div className="text-[length:var(--px-22)] font-semibold font-helvetica uppercase leading-[var(--px-24)]">
                        Welcome to Resomix
                    </div>
                    <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                        Discover new tracks that match your sound<br />in seconds.
                    </div>
                </div>
                <div className="flex flex-col items-start w-full gap-[var(--px-20)]">
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={dropSvg} aria-hidden="true" loading="lazy" draggable={false} alt="DropTrack" className="w-[var(--px-28)] h-[var(--px-28)]" />
                        <div className="flex flex-col items-start text-left">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-80 uppercase">
                                Drop a Track
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                Upload your favorite track or search from our library
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={matchSvg} aria-hidden="true" loading="lazy" draggable={false} alt="matchTrack" className="w-[var(--px-28)] h-[var(--px-28)]" />
                        <div className="flex flex-col items-start text-left">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-80 uppercase">
                                Our Advanced Model Crunches Similarity
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                We'll analyze the track's musical aspects
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-[var(--px-10)]">
                        <img src={discoverSvg} aria-hidden="true" loading="lazy" draggable={false} alt="discoverTrack" className="w-[var(--px-32)] h-[var(--px-32)]" />
                        <div className="flex flex-col items-start text-left -ml-[var(--px-4)]">
                            <div className="text-[length:var(--px-12)] font-medium font-fira leading-[var(--px-14)] opacity-80 uppercase">
                                Discover Similar Tracks
                            </div>
                            <div className="text-[length:var(--px-10)] font-light font-fira leading-[var(--px-13)] opacity-80">
                                Get instant recommendations that match your vibe
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-[var(--px-20)] flex justify-center items-center gap-[var(--px-10)]">
                    <ButtonSleek text="Let's Get Started" onClick={onClose} />
                </div>
            </div>
        </div>
    );
};
