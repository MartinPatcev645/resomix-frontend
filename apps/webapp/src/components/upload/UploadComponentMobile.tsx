import React, { useRef } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import ReferenceSvg from "@/assets/icons/reference.svg";
import { ButtonSleek } from "@resomix/ui";
import { useUpload } from "@resomix/hooks";

interface UploadComponentProps {
    onSearchClick?: () => void;
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const UploadComponentMobile: React.FC<UploadComponentProps> = ({ onSearchClick }) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { inputRef, inputAccept, onInputChange, openFilePicker } = useUpload();

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 315 383" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-355)] h-[length:var(--px-384)] pointer-events-none z-10">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M314 382.481V0.629395H181.014L136.651 67.2961H1.00195V382.481H314Z" />
                    </clipPath>
                </defs>
                <defs>
                    <clipPath id="containerTwo" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M1.24744 53.9628V0.629395H169.275L133.217 53.9628H1.24744Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M314 382.481V0.629395H181.014L136.651 67.2961H1.00195V382.481H314Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M1.24744 53.9628V0.629395H169.275L133.217 53.9628H1.24744Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M167.066 54.7035H298.79" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" />
            </svg>

            {/* Hidden file input for mobile (Android/iOS) */}
            <input
                ref={inputRef}
                type="file"
                accept={inputAccept}
                onChange={onInputChange}
                className="hidden"
            />

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-355)] h-[var(--px-384)] mx-auto z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    <div className="flex">
                        <div
                            className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline"
                            onClick={onSearchClick}
                        >
                            <div className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</div>
                            <img src={searchIcon} aria-label="search" draggable={false} alt="search" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                        <div className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2">
                            <div className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</div>
                            <img src={uploadIcon} aria-label="upload" draggable={false} alt="upload" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                    </div>
                    <div className="m-[var(--px-20)]">
                        <div className="w-full h-[var(--px-300)] bg-[var(--color-primary-background)] border border-dotted border-slate-200 my-[var(--px-20)]">
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <div className="mt-[var(--px-10)] text-[length:var(--px-18)] font-helvetica font-light text-center leading-[var(--px-24)] uppercase">
                                    Discover the Power of<br />Deep Sonic Analysis
                                </div>
                                <div className="flex items-center justify-center gap-[var(--px-10)] mt-[var(--px-10)] ml-[var(--px-16)]">
                                    <img src={ReferenceSvg} aria-hidden="true" loading="lazy" draggable={false} alt="sound waves" className="w-[var(--px-37)] h-[var(--px-37)] my-[var(--px-10)]" />
                                    <div className="text-[length:var(--px-12)] font-fira font-light text-left leading-[var(--px-15)] opacity-70">
                                        Drop in a reference sound.<br />It can be a released or<br />unreleased song, or just a short<br />sketch from your archive. Resomix<br />will analyze the audio and find<br />perfect matches for you.
                                    </div>
                                </div>
                                <div className="text-[length:var(--px-12)] opacity-70 font-fira font-light my-[var(--px-20)] text-center">
                                    {/* or */}
                                </div>
                                <ButtonSleek className="w-[var(--px-250)] upload-button" text="Upload Your Audio" onClick={openFilePicker} id="upload-component-upload-button" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
