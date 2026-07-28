import React, { useRef, useState } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { SearchInput, SearchDropdown, Tooltip } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import type { SearchResult } from "@resomix/hooks";
import { WorkspaceSearchField } from "./WorkspaceSearchField.tsx";
import { SEARCH_MODE_HINT, SEARCH_MODE_LABEL } from "@/sections/desktop/Workspace/workspaceCopy.ts";

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
    const [searchModeHelpOpen, setSearchModeHelpOpen] = useState(false);
    const { query, results, isLoading, handleQueryChange } = useSearch();

    const { searchMode, setSearchMode } = usePlayerStore();

    const handleSearchModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSearchMode(e.target.value as "auto" | "artist" | "title");
    };

    if (variant === "workspace") {
        return (
            <div ref={sectionRef}>
                <div className="grid grid-cols-1 items-stretch gap-[var(--px-16)] py-[var(--px-20)]">
                    <WorkspaceSearchField compact onTrackSelect={onTrackSelect} />
                    <div className="flex min-w-0 flex-col gap-[var(--px-7)]">
                        <span
                            className="flex items-center gap-[var(--px-7)] font-fira text-[length:var(--px-11)] uppercase tracking-[var(--px-1)] text-[rgba(255,255,255,.55)]"
                            id="search-mode-dropdown-mobile-label"
                        >
                            {SEARCH_MODE_LABEL}
                            <button
                                type="button"
                                className={[
                                    "inline-flex h-[var(--px-17)] w-[var(--px-17)] shrink-0 items-center justify-center rounded-full border font-fira text-[length:var(--px-10)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]",
                                    searchModeHelpOpen
                                        ? "border-[var(--color-accent,#EE4A26)] text-[var(--color-accent,#EE4A26)]"
                                        : "border-[rgba(255,255,255,.09)] text-[rgba(255,255,255,.55)] hover:border-[var(--color-accent,#EE4A26)] hover:text-[var(--color-accent,#EE4A26)]",
                                ].join(" ")}
                                aria-expanded={searchModeHelpOpen}
                                aria-controls="search-mode-help-mobile"
                                aria-label="About search mode"
                                onClick={() => setSearchModeHelpOpen((v) => !v)}
                            >
                                i
                            </button>
                        </span>
                        <select
                            id="search-mode-dropdown-mobile"
                            aria-labelledby="search-mode-dropdown-mobile-label"
                            aria-describedby={searchModeHelpOpen ? "search-mode-help-mobile" : undefined}
                            value={searchMode}
                            onChange={handleSearchModeChange}
                            className="h-[var(--px-52)] w-full appearance-none border border-[rgba(255,255,255,.16)] bg-[#0b0b0b] bg-[length:var(--px-10)] bg-[position:right_var(--px-14)_center] bg-no-repeat px-[var(--px-14)] font-fira text-[length:var(--px-14)] text-[var(--color-primary)] hover:border-[rgba(255,255,255,.28)] focus:border-[rgba(238,74,38,.55)] focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent,#EE4A26)]"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23B9B9B9' stroke-width='1.2'/%3E%3C/svg%3E")`,
                            }}
                        >
                            <option value="auto">Auto</option>
                            <option value="artist">Artist</option>
                            <option value="title">Title</option>
                        </select>
                    </div>
                </div>
                {searchModeHelpOpen && (
                    <p
                        id="search-mode-help-mobile"
                        className="mb-[var(--px-12)] border border-dashed border-[rgba(238,74,38,.4)] px-[var(--px-16)] py-[var(--px-12)] text-[length:var(--px-13)] font-helvetica font-light leading-[var(--px-20)] text-[rgba(255,255,255,.7)]"
                    >
                        {SEARCH_MODE_HINT}
                    </p>
                )}
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
