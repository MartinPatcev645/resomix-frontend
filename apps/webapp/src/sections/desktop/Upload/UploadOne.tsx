import React, { useState, useCallback } from "react";
import { useTrackSimilarity } from "@resomix/hooks";
import type { SearchResult } from "@resomix/hooks";
import InfoSvg from "@/assets/icons/info.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves.svg";
import TrackSelectSeparatorLine from "@/assets/icons/track_select_separator_line.svg"
import { SearchComponent, UploadComponent, PopularComponent } from "@/components/index.ts";
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

    // Callback fired by both upload and search flows when analysis results arrive
    const onAnalysis = useCallback((playlistId: string, stats: Parameters<typeof savePlaylistAnalysis>[1]) => {
        savePlaylistAnalysis(playlistId, stats);
    }, []);

    // Hook to trigger similarity lookup for a selected track
    const { handleSelectTrack } = useTrackSimilarity({ onAnalysis });

    const onTrackSelect = (track: SearchResult) => {
        handleSelectTrack(track.id);
    };

    const handleUploadClick = () => {
        setActiveComponent('upload');
    };

    const handleCountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setTopSk(Number(e.target.value));
    };



    return (
        <div className="flex flex-col mx-auto items-center justify-center mt-[var(--px-100)]">

            <div className="w-[var(--px-880)] h-[var(--px-61)] border border-dotted border-slate-200 flex justify-between px-[var(--px-12)] py-[var(--px-14)]">
                <div className="">
                    <h2 className="text-[length:var(--px-11)] font-light font-helvetica uppercase">
                        Set Your Depth
                    </h2>
                    <div className="text-[length:var(--px-9)] font-fira font-light opacity-70">
                        Choose how many similar tracks Resomix will recommend.
                    </div>
                </div>
                <div className="flex items-center gap-[var(--px-6)]">
                    <Tooltip message="Adjust How deep Resomix should dig. You can choose how many matches you want the platform to suggest." displayOnClick={true}>
                        <div className="flex items-center gap-[var(--px-6)] hover:cursor-pointer">
                            <label
                                htmlFor="upload-results-count-select-desktop"
                                className="text-[length:var(--px-9)] font-fira font-light mt-[var(--px-1)]"
                            >
                                Results Count
                            </label>
                            <div>
                                <img src={InfoSvg} draggable={false} alt="Info" aria-label="Info" className="w-[var(--px-10)] h-[var(--px-10)]" />
                            </div>
                        </div>
                    </Tooltip>
                    {/* Dropdown menu following same style */}
                    <div className="">
                        <select
                            id="upload-results-count-select-desktop"
                            aria-label="Upload results count"
                            value={topSk}
                            onChange={handleCountChange}
                            className="w-[var(--px-97)] h-[var(--px-26)] bg-transparent border border-dotted border-slate-200 text-[length:var(--px-11)] font-fira font-extralight text-center text-[var(--color-primary)] upload-settings-select"
                        >
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="10">10 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="20">20 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="50">50 tracks</option>
                            <option className="text-[length:var(--px-11)] font-fira font-extralight bg-[var(--color-primary-background)]" value="100">100 tracks</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex w-[var(--px-880)] h-auto justify-between mt-[var(--px-20)]">
                <div className="flex-1/2 mr-[var(--px-15)]">
                    {activeComponent === 'search' ? (
                        <SearchComponent
                            onUploadClick={handleUploadClick}
                            onTrackSelect={onTrackSelect}
                        />
                    ) : (
                        <UploadComponent
                            onSearchClick={handleSearchClick}
                            onAnalysis={onAnalysis}
                        />
                    )}
                </div>
                <div className="flex-1/2 ml-[var(--px-15)]">
                    <PopularComponent onTrackSelect={onTrackSelect} />
                </div>
            </div>
            <div className="flex flex-col w-[var(--px-880)] h-auto justify-between mt-[var(--px-40)] w-full items-center justify-center gap-[var(--px-20)]">
                <img src={TrackSelectSeparatorLine} aria-hidden="true" loading="lazy" draggable={false} alt="track_select_separator_line" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    After analysis, PYXIS-1 returns scored results ranked by<br />sonic similarity - with waveform preview and chain discovery.
                </div>
                <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves" className="w-[var(--px-40)] h-[var(--px-40)] my-[var(--px-10)]" />
            </div>
        </div >
    );
};

export default UploadOne;

