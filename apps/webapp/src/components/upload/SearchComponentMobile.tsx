import React, { useRef } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { SearchInput, SearchDropdown, Tooltip } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import type { SearchResult } from "@resomix/hooks";

interface SearchComponentProps {
    onUploadClick?: () => void;
    onTrackSelect?: (track: SearchResult) => void;
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const SearchComponentMobile: React.FC<SearchComponentProps> = ({ onUploadClick, onTrackSelect }) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { query, results, isLoading, handleQueryChange } = useSearch();
    
    // Get searchMode state and setter from the store
    const { searchMode, setSearchMode } = usePlayerStore();

    const handleSearchModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSearchMode(e.target.value as 'auto' | 'artist' | 'title');
    };

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
                    <div id="panel-search-mobile" role="tabpanel" aria-labelledby="tab-search-mobile" className="m-[var(--px-20)]">
                        <div className="w-full h-[var(--px-300)] border border-dotted border-slate-300 my-[var(--px-20)] relative">
                            {/* Search Mode Dropdown for Mobile */}
                            <div className="absolute top-[var(--px-8)] right-[var(--px-8)]">
                                <div className="flex items-center gap-[var(--px-4)]">
                                    <Tooltip message="Choose how Resomix should search: Auto (all fields), Artist (artist name only), or Title (track title only)." displayOnClick={true}>
                                        <div className="flex items-center gap-[var(--px-4)] hover:cursor-pointer">
                                            <label 
                                                htmlFor="search-mode-dropdown-mobile"
                                                className="text-[length:var(--px-8)] font-fira font-light"
                                            >
                                                Mode
                                            </label>
                                            <div>
                                                <img src={InfoSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-8)] h-[var(--px-8)]" />
                                            </div>
                                        </div>
                                    </Tooltip>
                                    <div className="">
                                        <select 
                                            id="search-mode-dropdown-mobile"
                                            aria-label="Search mode"
                                            value={searchMode}
                                            onChange={handleSearchModeChange}
                                            className="w-[var(--px-60)] h-[var(--px-20)] bg-transparent border border-dotted border-slate-200 text-[length:var(--px-9)] font-fira font-extralight text-center text-[var(--color-primary)]"
                                        >
                                            <option className="text-[length:var(--px-9)] font-fira font-extralight bg-[var(--color-primary-background)]" value="auto">Auto</option>
                                            <option className="text-[length:var(--px-9)] font-fira font-extralight bg-[var(--color-primary-background)]" value="artist">Artist</option>
                                            <option className="text-[length:var(--px-9)] font-fira font-extralight bg-[var(--color-primary-background)]" value="title">Title</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
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
