import React, { useRef } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import { SearchInput, SearchDropdown } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import type { SearchResult } from "@resomix/hooks";
import { WorkspaceSearchField } from "./WorkspaceSearchField.tsx";

interface SearchComponentProps {
    onUploadClick?: () => void;
    onTrackSelect?: (track: SearchResult) => void;
    hideSourceTabs?: boolean;
    variant?: "legacy" | "workspace";
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const SearchComponentMobile: React.FC<SearchComponentProps> = ({
    onUploadClick,
    onTrackSelect,
    hideSourceTabs = false,
    variant = "legacy",
}) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { query, results, isLoading, handleQueryChange } = useSearch();

    // Fixed to `auto` — see SearchComponent. Store value still feeds the search API.


    if (variant === "workspace") {
        return (
            <div ref={sectionRef}>
                <div className="grid grid-cols-1 items-stretch gap-[var(--px-16)] py-[var(--px-20)]">
                    <WorkspaceSearchField compact onTrackSelect={onTrackSelect} />
                </div>
            </div>
        );
    }

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 315 384" preserveAspectRatio="none" className="absolute inset-0 w-[var(--px-355)] h-[var(--px-384)] pointer-events-none z-10" aria-hidden="true">
                <defs>
                    <clipPath id="container" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0031746031,0.0026041666)" d="M1 383V1H133.987L178.35 67.6926H314V383H1Z" />
                    </clipPath>
                </defs>
                <defs>
                    <clipPath id="containerTwo" clipPathUnits="objectBoundingBox">
                        <path transform="scale(0.0031746031,0.0026041666)" d="M314 54.3541V1H145.971L164 27.677L182.03 54.3541H314Z" />
                    </clipPath>
                </defs>

                {/* stroke outline */}
                <path d="M1 383V1H133.987L178.35 67.6926H314V383H1Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M314 54.3541V1H145.971L164 27.677L182.03 54.3541H314Z" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" fill="none" />
                <path d="M21 55H152" stroke="white" strokeWidth="1" strokeDasharray="0.74 0.74" />
            </svg>

            {/* Tab container - positioned above the main content */}
            <div className="relative w-[var(--px-355)] h-[var(--px-384)] mx-auto z-30">
                {/* Tabs positioned to align with the tab shapes */}
                <div className="flex flex-col justify-start w-full h-full select-none py-auto">
                    {!hideSourceTabs && (
                        <div className="flex" role="tablist" aria-label="Search and upload tabs">
                            <button
                                id="tab-search-mobile"
                                role="tab"
                                aria-selected="true"
                                aria-controls="panel-search-mobile"
                                type="button"
                                className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2"
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</span>
                                <img src={searchIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                            <button
                                id="tab-upload-mobile"
                                role="tab"
                                aria-selected="false"
                                aria-controls="panel-upload-mobile"
                                type="button"
                                className="flex-1/2 h-[var(--px-60)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline search-component-upload-button"
                                onClick={onUploadClick}
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</span>
                                <img src={uploadIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                        </div>
                    )}
                    <div id="panel-search-mobile" role="tabpanel" aria-labelledby="tab-search-mobile" className="m-[var(--px-20)]">
                        <div className="w-full h-[var(--px-300)] border border-dotted border-slate-300 my-[var(--px-20)] relative">
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <div className="mt-[var(--px-10)] relative">
                                    {/** Search bar & dropdown */}
                                    <SearchInput value={query} onChange={handleQueryChange} placeholder="Search by keyword..." width="w-[var(--px-200)]" />
                                    <SearchDropdown
                                        show={query.length > 0}
                                        results={results}
                                        width="w-[var(--px-300)] -mr-[var(--px-30)]"
                                        truncateLength={20}
                                        isLoading={isLoading}
                                        isMobile={true}
                                        onSelect={onTrackSelect}
                                    />
                                </div>
                                <h3 className="text-[length:var(--px-12)] font-fira font-light text-center mt-[var(--px-30)]">
                                    Do you have a track<br />in mind?
                                </h3>
                                <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-33)] h-[var(--px-40)] my-[var(--px-10)]" />
                                <div className="text-[length:var(--px-12)] font-fira font-light text-center">
                                    Search the catalog,<br />PYXIS-1 handles the rest.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
