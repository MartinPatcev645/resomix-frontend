import React, { useRef, useState, useCallback, useEffect } from "react";
import searchIcon from "@/assets/icons/search.svg";
import uploadIcon from "@/assets/icons/arrow_upload.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { SearchInput, SearchDropdown, Tooltip } from "@resomix/ui";
import { useSearch } from "@resomix/hooks";
import { usePlayerStore } from "@resomix/stores";
import { DEMO_MODE } from "@resomix/config";
import type { SearchResult } from "@resomix/hooks";
import { WorkspaceSearchField } from "./WorkspaceSearchField.tsx";

interface SearchComponentProps {
    onUploadClick?: () => void;
    /**
     * Invoked when the user selects a track from the dropdown.
     */
    onTrackSelect?: (track: SearchResult) => void;
    /** Hide the built-in Search/Upload tab row when an outer workspace tablist owns source switching. */
    hideSourceTabs?: boolean;
    /** Visual skin — `workspace` is flat panel interior; default preserves legacy chrome everywhere else. */
    variant?: "legacy" | "workspace";
}

/**
 * Simple structural mock-up of the desktop search section.
 * All copy / visuals are placeholders – tweak freely.
 */
export const SearchComponent: React.FC<SearchComponentProps> = ({
    onUploadClick,
    onTrackSelect,
    hideSourceTabs = false,
    variant = "legacy",
}) => {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const { query, results, isLoading, handleQueryChange } = useSearch();
    const [showSearchHint, setShowSearchHint] = useState(false);
    const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const { searchMode, setSearchMode } = usePlayerStore();

    const handleSearchModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSearchMode(e.target.value as "auto" | "artist" | "title");
    };

    const handleSearchInputChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (DEMO_MODE) {
                setShowSearchHint(true);
                if (hintTimerRef.current) {
                    clearTimeout(hintTimerRef.current);
                }
                hintTimerRef.current = setTimeout(() => {
                    setShowSearchHint(false);
                }, 3000);
                return;
            }
            handleQueryChange(e);
        },
        [handleQueryChange],
    );

    const handleSearchInputFocus = useCallback(() => {
        if (DEMO_MODE) {
            setShowSearchHint(true);
            if (hintTimerRef.current) {
                clearTimeout(hintTimerRef.current);
            }
            hintTimerRef.current = setTimeout(() => {
                setShowSearchHint(false);
            }, 3000);
        }
    }, []);

    useEffect(() => {
        if (!DEMO_MODE) {
            return;
        }
        return () => {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        };
    }, []);

    if (variant === "workspace") {
        return (
            <div ref={sectionRef}>
                <div className="flex flex-wrap items-stretch gap-[var(--px-10)]">
                    <div className="relative flex min-w-[min(100%,20rem)] flex-1">
                        <WorkspaceSearchField
                            demoMode={DEMO_MODE}
                            onDemoFocus={handleSearchInputFocus}
                            onDemoChange={handleSearchInputFocus}
                            onTrackSelect={onTrackSelect}
                        />
                        {DEMO_MODE && showSearchHint && (
                            <div
                                role="status"
                                aria-live="polite"
                                className="absolute -top-[var(--px-32)] left-0 z-40 whitespace-nowrap rounded bg-[#FFCC00] px-[var(--px-8)] py-[var(--px-4)] text-[length:var(--px-10)] font-semibold text-black shadow-md ring-2 ring-black/10"
                            >
                                Demo mode - Search functionality limited while we complete licensing
                            </div>
                        )}
                    </div>
                    <select
                        id="search-mode-dropdown"
                        aria-label="Search mode"
                        value={searchMode}
                        onChange={handleSearchModeChange}
                        className="min-h-[var(--px-44)] appearance-none border border-dotted border-slate-400 bg-[#0e0e0e] bg-[length:var(--px-10)] bg-[position:right_var(--px-10)_center] bg-no-repeat px-[var(--px-10)] py-[var(--px-10)] pr-[var(--px-28)] font-fira text-[length:var(--px-11)] text-[var(--color-primary)] opacity-75"
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
        );
    }

    return (
        <div ref={sectionRef} className="relative">
            {/* Hidden SVG defs for clip-path */}
            <svg viewBox="0 0 474 393" preserveAspectRatio="none" className="absolute inset-0 w-[length:var(--px-474)] h-[length:var(--px-383)] pointer-events-none z-10" aria-hidden="true">
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
                    {!hideSourceTabs && (
                        <div className="flex" role="tablist" aria-label="Search and upload tabs">
                            <button
                                id="tab-search"
                                role="tab"
                                aria-selected="true"
                                aria-controls="panel-search"
                                type="button"
                                className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2"
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">SEARCH</span>
                                <img src={searchIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                            <button
                                id="tab-upload"
                                role="tab"
                                aria-selected="false"
                                aria-controls="panel-upload"
                                type="button"
                                className="flex-1/2 h-[var(--px-55)] p-3 flex items-center justify-center gap-2 hover:cursor-pointer hover:underline search-component-upload-button"
                                onClick={onUploadClick}
                            >
                                <span className="text-[var(--color-primary)] text-[length:var(--px-16)] font-helvetica uppercase font-light">UPLOAD</span>
                                <img src={uploadIcon} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-16)] h-[var(--px-16)]" />
                            </button>
                        </div>
                    )}
                    <div id="panel-search" role="tabpanel" aria-labelledby="tab-search" className="m-[var(--px-30)]">
                        <div className="w-full h-[var(--px-265)] border border-dotted border-slate-300">
                            <div className="w-full flex justify-end p-[var(--px-12)] absolute right-[var(--px-24)]">
                                {/* Search Mode Dropdown */}
                                <div className="flex items-center gap-[var(--px-6)]">
                                    <Tooltip message="Choose how Resomix should search: Auto (all fields), Artist (artist name only), or Title (track title only)." displayOnClick={true}>
                                        <div className="flex items-center gap-[var(--px-6)] hover:cursor-pointer">
                                            <label
                                                htmlFor="search-mode-dropdown"
                                                className="text-[length:var(--px-9)] font-fira font-light mt-[var(--px-1)]"
                                            >
                                                Search Mode
                                            </label>
                                            <div>
                                                <img src={InfoSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-10)] h-[var(--px-10)]" />
                                            </div>
                                        </div>
                                    </Tooltip>
                                    <div className="">
                                        <select
                                            id="search-mode-dropdown"
                                            aria-label="Search mode"
                                            value={searchMode}
                                            onChange={handleSearchModeChange}
                                            className="w-[var(--px-80)] h-[var(--px-26)] bg-transparent border border-dotted border-slate-200 text-[length:var(--px-11)] font-fira font-extralight text-center text-[var(--color-primary)]"
                                        >
                                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="auto">Auto</option>
                                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="artist">Artist</option>
                                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="title">Title</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col w-full h-full justify-center items-center">
                                <div className="mt-[var(--px-10)] relative">
                                    {/** Search bar & dropdown */}
                                    <div className="relative inline-block">
                                        {DEMO_MODE && showSearchHint && (
                                            <div
                                                role="status"
                                                aria-live="polite"
                                                className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#FFCC00] text-black text-[length:var(--px-10)] font-semibold px-2 py-1 rounded shadow-md ring-2 ring-black/10 z-20"
                                            >
                                                Demo mode - Search functionality limited while we complete licensing
                                            </div>
                                        )}
                                        {DEMO_MODE && showSearchHint && (
                                            <span
                                                aria-hidden="true"
                                                className="pointer-events-none absolute -inset-1 rounded-md ring-2 ring-[#FFCC00] animate-pulse z-10"
                                            />
                                        )}
                                        <div className="relative z-20">
                                            <SearchInput
                                                value={DEMO_MODE ? "" : query}
                                                onChange={handleSearchInputChange}
                                                onFocus={handleSearchInputFocus}
                                                placeholder="Search by artist or title..."
                                                width="w-[var(--px-310)]"
                                            />
                                        </div>
                                    </div>
                                    {!DEMO_MODE && (
                                        <SearchDropdown
                                            show={query.length > 0}
                                            results={results}
                                            width="w-[var(--px-310)]"
                                            truncateLength={22}
                                            isLoading={isLoading}
                                            onSelect={onTrackSelect}
                                        />
                                    )}
                                </div>
                                <h3 className="text-[length:var(--px-11)] font-fira font-light text-center mt-[var(--px-30)]">
                                    Do you have a track in mind?
                                </h3>
                                <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="" className="w-[var(--px-29)] h-[var(--px-36)] my-[var(--px-10)]" />
                                <div className="text-[length:var(--px-11)] font-fira font-light text-center">
                                    Search the catalog, PYXIS-1 handles the rest.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
