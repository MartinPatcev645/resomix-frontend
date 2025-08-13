import React, { useRef } from "react";
import soundWhiteIcon from "@/assets/icons/sound_white.svg";
import soundIcon from "@/assets/icons/sound.svg";
import { usePopularTracks } from "@resomix/hooks";

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const PopularComponentMobile: React.FC = () => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { popularTracks } = usePopularTracks();

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 360 71" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-355)] h-[length:var(--px-70)] pointer-events-none z-10">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0027777777,0.0140845070)" d="M1 70.0499V1.04993L315.571 1.04999L337.286 35.55L359 70.0499L1 70.0499Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M1 70.0499V1.04993L315.571 1.04999L337.286 35.55L359 70.0499L1 70.0499Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
            </svg>

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-355)] z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none gap-[var(--px-10)]">
                    <div className="w-full h-[var(--px-70)] text-center gap-2 flex items-center justify-center">
                        <div className="text-white text-[length:var(--px-18)] font-helvetica uppercase font-light">Beats Ready For You</div>
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] mt-[var(--px-10)]">
                        {popularTracks.map((track) => (
                            <div
                                key={track.uuid}
                                className="group w-full h-[var(--px-70)] bg-[var(--color-primary-background)] border border-dotted border-slate-200 my-auto flex justify-between items-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] transition-colors"
                            >
                                <div className="flex items-center gap-[var(--px-30)] ml-[var(--px-30)]">
                                    <span className="relative w-[var(--px-12)] h-[var(--px-12)] inline-block">
                                        <img
                                            src={soundWhiteIcon}
                                            alt="sound"
                                            className="absolute inset-0 w-[var(--px-16)] h-[var(--px-16)] transition-opacity duration-150 opacity-100 group-hover:opacity-0"
                                        />
                                        <img
                                            src={soundIcon}
                                            alt="sound-hover"
                                            className="absolute inset-0 w-[var(--px-12)] h-[var(--px-12)] transition-opacity duration-150 opacity-0 group-hover:opacity-100"
                                        />
                                    </span>
                                    <div className="flex flex-col items-start">
                                        <div className="text-white group-hover:text-[color:var(--color-text-primary)] transition-colors text-[length:var(--px-15)] font-helvetica leading-[var(--px-20)] font-light tracking-[var(--px-1)] uppercase">
                                            {track.title}
                                        </div>
                                        <div className="text-white group-hover:text-[color:var(--color-text-primary)] transition-colors text-[length:var(--px-12)] font-fira leading-[var(--px-18)] font-light tracking-[var(--px-1)]">
                                            {track.artist}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-white group-hover:text-[color:var(--color-text-primary)] group-hover:opacity-100 transition-colors text-[length:var(--px-12)] font-fira font-light opacity-70 mr-[var(--px-16)]">
                                    {track.duration}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
