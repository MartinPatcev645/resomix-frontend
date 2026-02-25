import React, { useState, useCallback } from "react";
import { useTrackSimilarity } from "@resomix/hooks";
import type { SearchResult } from "@resomix/hooks";
import InfoSvg from "@/assets/icons/info.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import TrackSelectSeparatorLine from "@/assets/icons/track_select_separator_line.svg"
import { SearchComponentMobile, UploadComponentMobile, PopularComponentMobile } from "@/components/index.ts";
import { Tooltip } from "@resomix/ui";
import { usePlayerStore } from "@resomix/stores";
import { savePlaylistAnalysis } from "@/utils/playlistAnalysis.ts";

const UploadOne: React.FC = () => {
    const [activeComponent, setActiveComponent] = useState<'search' | 'upload'>('search');

    // Get topSk state from the store
    const { topSk, setTopSk } = usePlayerStore();

    const handleSearchClick = () => {
        setActiveComponent('search');
    };

    const handleUploadClick = () => {
        setActiveComponent('upload');
    };

    const handleCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setTopSk(Number(e.target.value));
    };



    // Callback fired by both upload and search flows when analysis results arrive
    const onAnalysis = useCallback((playlistId: string, stats: Parameters<typeof savePlaylistAnalysis>[1]) => {
        savePlaylistAnalysis(playlistId, stats);
    }, []);

    const { handleSelectTrack } = useTrackSimilarity({ onAnalysis });

    const onTrackSelect = (track: SearchResult) => {
        handleSelectTrack(track.id);
    };

    return (
        <div className="flex flex-col mx-auto items-center justify-center mt-[var(--px-100)]">

            <div className="w-full flex justify-between py-[var(--px-14)]">
                <div className="">
                    <h2 className="text-[length:var(--px-18)] font-semibold font-helvetica uppercase">
                        Set Your Depth
                    </h2>
                    <div className="text-[length:var(--px-9)] font-fira font-light leading-[var(--px-12)] opacity-70">
                        Choose how many similar tracks Resomix<br />will recommend.
                    </div>
                </div>
                <div className="flex flex-col items-center gap-[var(--px-6)]">
                    {/* Custom dropdown that works consistently on iOS / Android */}
                    <div
                        className="relative w-[var(--px-97)] h-[var(--px-26)] border border-dotted border-slate-200 flex items-center justify-center gap-[var(--px-6)] text-[length:var(--px-11)] font-fira font-extralight text-[var(--color-primary)]"
                    >
                        {/* Invisible native select covers full area to keep accessibility & native picker */}
                        <select
                            aria-label="Upload results count"
                            id="upload-results-count-select-mobile"
                            value={topSk}
                            onChange={handleCountChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none upload-settings-select"
                        >
                            <option value="10">10 tracks</option>
                            <option value="20">20 tracks</option>
                            <option value="50">50 tracks</option>
                            <option value="100">100 tracks</option>
                        </select>

                        {/* Visible label and arrow */}
                        <span className="pointer-events-none">{topSk} tracks</span>
                        {/* Inline SVG arrow */}
                        <svg
                            aria-hidden="true"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 52 53"
                            className="w-[var(--px-10)] h-[var(--px-10)] pointer-events-none"
                            fill="none"
                        >
                            <path
                                d="M41.6639 19.2529L26.5404 34.3764L11.417 19.2529"
                                stroke="white"
                                strokeWidth={5}
                                strokeLinecap="square"
                                strokeDasharray="1 1"
                            />
                        </svg>
                    </div>
                    <Tooltip message="Adjust How deep Resomix should dig. You can choose how many matches you want the platform to suggest." displayOnClick={true}>
                        <div className="flex items-center gap-[var(--px-6)]">
                            <label
                                htmlFor="upload-results-count-select-mobile"
                                className="text-[length:var(--px-9)] font-fira font-light"
                            >
                                Results Count
                            </label>
                            <div className="hover:cursor-pointer">
                                <img src={InfoSvg} alt="Info" aria-label="Info" draggable={false} className="w-[var(--px-10)] h-[var(--px-10)]" />
                            </div>
                        </div>
                    </Tooltip>
                </div>
            </div>
            <div className="flex flex-col mt-[var(--px-20)]">
                <div className="">
                    {activeComponent === 'search' ? (
                        <SearchComponentMobile
                            onUploadClick={handleUploadClick}
                            onTrackSelect={onTrackSelect}
                        />
                    ) : (
                        <UploadComponentMobile
                            onSearchClick={handleSearchClick}
                            onAnalysis={onAnalysis}
                        />
                    )}
                </div>
                <div className="mt-[var(--px-150)]">
                    <PopularComponentMobile onTrackSelect={onTrackSelect} />
                </div>
            </div>
            <div className="flex flex-col w-[var(--px-880)] h-auto justify-between mt-[var(--px-80)] w-full items-center justify-center gap-[var(--px-20)]">
                <img src={TrackSelectSeparatorLine} aria-hidden="true" loading="lazy" draggable={false} alt="track_select_separator_line" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    After analysis, PYXIS-1 returns scored results ranked by sonic similarity - with waveform preview and chain discovery.
                </div>
                <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves" className="w-[var(--px-40)] h-[var(--px-40)] my-[var(--px-10)]" />
            </div>
        </div>
    );
};

export default UploadOne;
