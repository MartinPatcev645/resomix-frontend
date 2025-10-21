import React from "react";
import { ButtonSleek, HoverFlow } from "@resomix/ui";
import MenuSeparator from "@/assets/icons/menu_separator.svg";
import { ThumbIcon } from "@/components/index.ts";
import { rateTrack } from "@resomix/api-client";
import { usePlaylistStore } from "@resomix/stores";
import { BASE_BETA_URL } from "@resomix/config";
import { formatDuration, formatPercentage, usePlaylistExport } from "@resomix/hooks";
import { getTrackRating, saveTrackRating } from "@/utils/trackRatingsStorage.js";

import MobileSpotifyExportSheet from "@/components/Modals/MobileSpotifyExportSheet.js";
import MobileTidalExportSheet from "@/components/Modals/MobileTidalExportSheet.js";

interface MoreMenuProps {
    onClose?: () => void;
    trackId?: string;
    isInput?: boolean;
    name?: string;
    label?: string;
    duration?: number; // in seconds
    score?: number | null;
}

const MoreMenu: React.FC<MoreMenuProps> = ({ onClose, trackId, isInput = false, name, label, duration, score = null }) => {
    const { playlistData, trackRatings = {}, setTrackRating } = usePlaylistStore();
    const { exportAndDownloadPlaylist, canExport } = usePlaylistExport();
    const [exportButtonText, setExportButtonText] = React.useState("Export Playlist");

    const [isSpotifyOpen, setIsSpotifyOpen] = React.useState(false);
    const [isTidalOpen, setIsTidalOpen] = React.useState(false);

    const handleStatusChange = React.useCallback((status: 'loading' | 'success' | 'error', message: string, title?: string) => {
        console.log('[MOBILE EXPORT]', status, title, message);
    }, []);

    React.useEffect(() => {
        if (!trackId) return;
        const localRating = getTrackRating(trackId);
        if (localRating !== undefined && trackRatings[trackId] === undefined) {
            setTrackRating(trackId, localRating);
        }
    }, [trackId, trackRatings, setTrackRating]);

    const handleTrackRating = async (rating: number) => {
        if (!trackId) return;

        try {
            const playlistId = playlistData?.playlist.id || null;
            setTrackRating(trackId, rating);
            saveTrackRating(trackId, rating);
            await rateTrack(trackId, rating, playlistId);
        } catch (error) {
            console.error('Failed to rate track:', error);
        }
    };

    const handleExportPlaylist = async () => {
        if (!canExport) return;

        try {
            const result = await exportAndDownloadPlaylist();

            if (result.success) {
                setExportButtonText("Downloaded!");
                setTimeout(() => {
                    setExportButtonText("Export Playlist");
                }, 2000);
            }
        } catch (error) {
            console.error('Failed to export playlist:', error);
        }
    };

    React.useEffect(() => {
        const scrollY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.width = '100%';

        return () => {
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, scrollY);
        };
    }, []);

    const initialPlaylistId = playlistData?.playlist?.id ?? '';

    return (
      <div className="w-full h-full min-h-screen relative overflow-hidden bg-[var(--color-primary-background)]">
          <div className="flex flex-col justify-between h-full min-h-screen relative z-15 text-[var(--color-primary)] py-[var(--px-60)] px-[var(--px-40)] overflow-y-auto overflow-x-hidden">
              <div className="flex flex-col gap-[var(--px-30)] items-center">
                  <h2 className="text-[length:var(--px-22)] font-light uppercase font-helvetica text-center w-[var(--px-300)] truncate">
                      <HoverFlow
                        text={name ?? ''}
                        maxChars={23}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="300px"
                      />
                  </h2>
                  <div className="">
                      <img src={MenuSeparator} aria-hidden="true" loading="lazy" draggable={false} alt="MenuSeparator" className="w-[var(--px-4)] h-[var(--px-49)]" />
                  </div>
                  <div className="flex flex-col gap-[var(--px-10)] w-full">
                      <dl className="flex flex-col gap-[var(--px-10)] w-full">
                          <div className="flex w-full justify-between">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Label:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{label && label.trim() !== '' ? label : '-'}</dd>
                          </div>
                          <div className="flex w-full justify-between">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Duration:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{duration !== undefined ? formatDuration(duration) : '--:--'}</dd>
                          </div>
                          {!isInput && (
                            <div className="flex w-full justify-between">
                                <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Score:</dt>
                                <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{score !== null && score !== undefined ? formatPercentage(score, 2) : '—'}</dd>
                            </div>
                          )}

                          {!isInput && (
                            <div className="flex w-full justify-between mt-[var(--px-20)]">
                                <div className="text-left text-[length:var(--px-14)] font-light font-fira">Similar:</div>
                                <div className="flex items-center justify-end w-[var(--px-80)] gap-[var(--px-30)]">
                                    {(() => {
                                        const currentRating = trackId ? trackRatings[trackId] : undefined;
                                        const upSelected = currentRating === 1;
                                        const downSelected = currentRating === 0;
                                        return (
                                          <>
                                              <ThumbIcon
                                                onClick={() => {
                                                    if (upSelected) return;
                                                    handleTrackRating(1);
                                                }}
                                                className={`w-[var(--px-26)] h-[var(--px-26)] text-white ${upSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-up`}
                                                id={`playlist-table-thumb-up-${trackId}`}
                                              />
                                              <ThumbIcon
                                                onClick={() => {
                                                    if (downSelected) return;
                                                    handleTrackRating(0);
                                                }}
                                                className={`w-[var(--px-26)] h-[var(--px-26)] transform rotate-180 text-white ${downSelected ? 'fill-current' : 'fill-transparent hover:fill-current'} hover:cursor-pointer playlist-rating-thumb-down`}
                                                id={`playlist-table-thumb-down-${trackId}`}
                                              />
                                          </>
                                        );
                                    })()}
                                </div>
                            </div>
                          )}
                          <div className="flex w-full justify-between mt-[var(--px-20)]">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Status:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Active</dd>
                          </div>
                          <div className="flex w-full justify-between">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Mode:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Universal</dd>
                          </div>
                          <div className="flex w-full justify-between">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">Peaks:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">Loaded</dd>
                          </div>
                          <div className="flex w-full justify-between">
                              <dt className="text-left text-[length:var(--px-14)] font-light font-fira">ID:</dt>
                              <dd className="text-right text-[length:var(--px-14)] font-light font-fira truncate max-w-[var(--px-220)]">{trackId}</dd>
                          </div>
                      </dl>
                  </div>
                  <div className="flex flex-col gap-[var(--px-10)] w-full px-[var(--px-3)]">
                      {!isInput && (
                        <div className="w-full">
                            <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-sonic-discovery-button" text="Start Sonic Discovery on this Track" customWidth="w-full" onClick={() => {
                                window.location.href = `${BASE_BETA_URL}/?id=${trackId}`;
                            }} id={`playlist-table-sonic-discovery-${trackId}`} />
                        </div>
                      )}
                      {isInput && (
                        <>
                            <div className="w-full">
                                <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-export-button" text={exportButtonText} customWidth="w-full" onClick={handleExportPlaylist} id={`playlist-hero-export-button`} />
                            </div>

                            {/* NEW: Spotify / TIDAL для мобилки */}
                            <div className="w-full">
                                <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-export-spotify-button" text="Export to Spotify" customWidth="w-full" onClick={() => setIsSpotifyOpen(true)} id={`playlist-hero-export-spotify`} />
                            </div>
                            <div className="w-full">
                                <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] playlist-export-tidal-button" text="Export to TIDAL" customWidth="w-full" onClick={() => setIsTidalOpen(true)} id={`playlist-hero-export-tidal`} />
                            </div>
                        </>
                      )}
                      <div className="w-full">
                          <ButtonSleek transparent={true} className="w-[var(--px-276)] text-[length:var(--px-14)] menu-link" text="Close" customWidth="w-full" onClick={onClose || (() => { })} id={`beta-menu-close-button`} />
                      </div>
                  </div>
              </div>
          </div>

          {/* NEW: Мобильные шиты */}
          <MobileSpotifyExportSheet
            isOpen={isSpotifyOpen}
            onClose={() => setIsSpotifyOpen(false)}
            onStatusChange={handleStatusChange}
            initialPlaylistId={initialPlaylistId}
          />
          <MobileTidalExportSheet
            isOpen={isTidalOpen}
            onClose={() => setIsTidalOpen(false)}
            onStatusChange={handleStatusChange}
            initialPlaylistId={initialPlaylistId}
          />
      </div >
    );
};

export default MoreMenu;