import React, { useRef } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import { SearchInput, SearchDropdown } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";

interface SearchComponentProps {
    onUploadClick?: () => void;
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const SearchComponent: React.FC<SearchComponentProps> = ({ onUploadClick }) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { query, results, isLoading, handleQueryChange } = useSearch();

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 474 393" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-474)] h-[length:var(--px-383)] pointer-events-none z-10">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M1 382.815V0.962952H201.794L268.778 67.6297H473.593V382.815H1Z" />
                    </clipPath>
                </defs>
                <defs>
                    <clipPath id="containerTwo" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0021097046,0.0026109660)" d="M473.593 54.2963V0.962952H219.889L247.111 27.6296L274.333 54.2963H473.593Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M1 382.815V0.962952H201.794L268.778 67.6297H473.593V382.815H1Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M473.593 54.2963V0.962952H219.889L247.111 27.6296L274.333 54.2963H473.593Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M30.6289 55.037H229.518" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" />
            </svg>

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-474)] h-[var(--px-383)] mx-auto z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    <div className="flex">
                        <div className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2">
                            <div className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</div>
                            <img src={searchIcon} alt="search" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                        <div 
                            className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline"
                            onClick={onUploadClick}
                        >
                            <div className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</div>
                            <img src={uploadIcon} alt="upload" className="w-[var(--px-16)] h-[var(--px-16)]" />
                        </div>
                    </div>
                    <div className="m-[var(--px-30)]">
                        <div className="w-full h-[var(--px-265)] bg-[var(--color-primary-background)] border border-dotted border-slate-300">
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <div className="mt-[var(--px-10)] relative">
                                    {/** Search bar & dropdown */}
                                    <SearchInput value={query} onChange={handleQueryChange} placeholder="Find Existing Tracks..." width="w-[var(--px-310)]" />
                                    <SearchDropdown show={query.length > 0} results={results} width="w-[var(--px-310)]" truncateLength={24} isLoading={isLoading} onSelect={() => { }} />
                                </div>
                                <div className="text-[length:var(--px-11)] font-fira font-light text-center mt-[var(--px-30)]">
                                    Do you have a song in mind?
                                </div>
                                <img src={SoundWavesSvg} alt="sound waves" className="w-[var(--px-29)] h-[var(--px-36)] my-[var(--px-10)]" />
                                <div className="text-[length:var(--px-11)] font-fira font-light text-center">
                                    Let's find tunes that resonate with it!
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
