import React, { useRef } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import ReferenceSvg from "@/assets/icons/reference.svg";
import { ButtonSleek } from "@resomix/ui";

interface UploadComponentProps {
    onSearchClick?: () => void;
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const UploadComponent: React.FC<UploadComponentProps> = ({ onSearchClick }) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 474 393" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-474)] h-[length:var(--px-383)] pointer-events-none z-10">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M473.594 382.481V0.629456H272.8L205.816 67.2962H1.00116V382.481H473.594Z" />
                    </clipPath>
                </defs>
                <defs>
                    <clipPath id="containerTwo" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M1.37248 53.9628V0.629456H255.076L200.632 53.9628H1.37248Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M473.594 382.481V0.629456H272.8L205.816 67.2962H1.00116V382.481H473.594Z" stroke="white" stroke-width="1" stroke-dasharray="0.74 0.74" fill="none" />
                <path d="M1.37248 53.9628V0.629456H255.076L200.632 53.9628H1.37248Z" stroke="white" stroke-width="1" stroke-dasharray="0.74 0.74" fill="none" />
                <path d="M251.742 54.7036H450.631" stroke="white" stroke-width="1" stroke-dasharray="0.74 0.74" />
            </svg>

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-474)] h-[var(--px-383)] mx-auto z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    <div className="flex">
                        <div
                            className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline"
                            onClick={onSearchClick}
                        >
                            <div className="text-white text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</div>
                            <img src={searchIcon} alt="search" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                        <div className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2">
                            <div className="text-white text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</div>
                            <img src={uploadIcon} alt="upload" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                    </div>
                    <div className="m-[var(--px-30)]">
                        <div className="w-full h-[var(--px-265)] bg-[var(--color-primary-background)] border border-dotted border-slate-300">
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <div className="mt-[var(--px-10)] text-[length:var(--px-16)] font-helvetica font-light text-center leading-[var(--px-20)] uppercase">
                                    Upload your Audio
                                </div>
                                <div className="flex items-center justify-center gap-[var(--px-10)] mt-[var(--px-10)]">
                                    <img src={ReferenceSvg} alt="sound waves" className="w-[var(--px-33)] h-[var(--px-33)] my-[var(--px-10)]" />
                                    <div className="text-[length:var(--px-9)] font-fira font-light text-left leading-[var(--px-14)] opacity-70">
                                        Drop in a reference sound.<br />It can be a released or unreleased song, or just a<br />short sketch from your archive. Resomix will analyze<br />the audio and find perfect matches for you.
                                    </div>
                                </div>
                                <div className="text-[length:var(--px-9)] font-fira font-light my-[var(--px-20)] text-center">
                                    or
                                </div>
                                <ButtonSleek text="Upload Your Audio" onClick={() => { }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
