import React, { useRef } from "react";
import soundWhiteIcon from "@/assets/icons/sound_white.svg";
import soundIcon from "@/assets/icons/sound.svg";
import { usePopularTracks } from "@resomix/hooks";
import type { SearchResult } from "@resomix/hooks";

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const PopularComponent: React.FC<{ onTrackSelect?: (track: SearchResult) => void }> = ({ onTrackSelect }) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { popularTracks } = usePopularTracks();

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 389 55" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-389)] h-[length:var(--px-53)] pointer-events-none z-10" aria-hidden="true">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0030674846,0.0181818181)" d="M1 54.3334V1L333.556 1.00004L360.778 27.6667L388 54.3334L1 54.3334Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M1 54.3334V1L333.556 1.00004L360.778 27.6667L388 54.3334L1 54.3334Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
            </svg>

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-389)] z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    <div className="p-4 text-center gap-2">
                        <h3 className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">Beats Ready For You</h3>
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] mt-[var(--px-10)]">
                        {popularTracks.map((track) => (
                            <button
                                key={track.id}
                                type="button"
                                id={`popular-track-${track.id}`}
                                className="group w-full h-[var(--px-53-5)] border border-dotted border-slate-200 my-auto flex justify-between items-center hover:cursor-pointer hover:bg-[var(--color-primary-hover)] transition-colors"
                                onClick={() => onTrackSelect?.(track)}
                                aria-label={`Play ${track.title} by ${track.artist}`}
                            >
                                <div className="flex items-center gap-[var(--px-30)] ml-[var(--px-30)]">
                                    <span className="relative w-[var(--px-12)] h-[var(--px-12)] inline-block">
                                        <img
                                            src={soundWhiteIcon}
                                            alt=""
                                            aria-hidden="true"
                                            className="absolute inset-0 w-[var(--px-12)] h-[var(--px-12)] transition-opacity duration-150 opacity-100 group-hover:opacity-0"
                                        />
                                        <img
                                            src={soundIcon}
                                            alt=""
                                            aria-hidden="true"
                                            className="absolute inset-0 w-[var(--px-12)] h-[var(--px-12)] transition-opacity duration-150 opacity-0 group-hover:opacity-100"
                                        />
                                    </span>
                                    <div className="flex flex-col items-start">
                                        <div className="text-[var(--color-primary)] group-hover:text-[color:var(--color-text-primary)] transition-colors text-[length:var(--px-11)] font-helvetica leading-[var(--px-14)] font-light tracking-[var(--px-1)] uppercase">
                                            {track.title}
                                        </div>
                                        <div className="text-[var(--color-primary)] group-hover:text-[color:var(--color-text-primary)] transition-colors text-[length:var(--px-9)] font-fira leading-[var(--px-14)] font-light tracking-[var(--px-1)]">
                                            {track.artist}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[var(--color-primary)] group-hover:text-[color:var(--color-text-primary)] group-hover:opacity-100 transition-colors text-[length:var(--px-8)] font-fira font-light opacity-70 mr-[var(--px-16)]">
                                    {track.duration}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
