import React from "react";
import { IconButton, HoverFlow, StatusMessage, PrivateIcon, PublicIcon } from "@resomix/ui";
import { formatDuration } from "@resomix/hooks";
import { usePlaylistStore, usePlayerStore } from "@resomix/stores";
import { InputPlayer, PlaylistRating, PlaylistShare, PlaylistRename } from "@/components/index.ts";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";
import StarSvg from "@/assets/icons/star_white.svg";
import StarBlackSvg from "@/assets/icons/star.svg";
import MoreSvg from "@/assets/icons/more.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import TimeSvg from "@/assets/icons/time.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { BASE_BETA_URL, DEMO_MODE } from "@resomix/config";

const InputTrackStatus = "Loading..."

interface PlaylistHeroProps {
  /**
   * Callback when the user requests the More-menu for a track.
   * @param trackId   The ID of the track.
   * @param isInput   Whether the track is the input (queried) track.
   */
  onMoreClick?: (trackId: string, name: string, label: string, duration: number, score: number | null, isInput?: boolean) => void;
}

const PlaylistHero: React.FC<PlaylistHeroProps> = ({ onMoreClick }) => {
  const [showMeta, setShowMeta] = React.useState(false);
  const [showRating, setShowRating] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = React.useState('');
  const [statusTitle, setStatusTitle] = React.useState('');

  const { playlistData } = usePlaylistStore();
  // const { uploadedUrl } = usePlayerStore();
  const { autoplay, setAutoplay, uploadedCoverArt } = usePlayerStore();
  void autoplay;
  void setAutoplay;

  const handleStatusChange = (type: 'loading' | 'success' | 'error', message: string, title?: string) => {
    setStatusType(type);
    setStatusMessage(message);
    setStatusTitle(title || '');
    setShowStatus(true);
  };

  const handleRenameClose = () => {
    setShowRename(false);
  };

  const handleRatingClose = () => {
    setShowRating(false);
  };

  const handleStatusClose = () => {
    setShowStatus(false);
  };

  return (
    <div className="relative">
      {/* Overlay content */}
      <div className="flex flex-col items-center justify-between w-full h-full select-none pt-[var(--px-55)]">
        <div></div>
        <div className="flex flex-col w-full gap-[var(--px-10)]">
          <div className="flex w-full justify-between items-center">
            <a
              href={BASE_BETA_URL}
              className="flex items-center ml-[var(--px-10)] playlist-nav-link"
              id="playlist-hero-back-link"
              aria-label="Back to upload"
            >
              <img src={AngleLeftSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-30)] h-[var(--px-30)]" />
            </a>
            <div className="flex flex-col items-center gap-[var(--px-15)]">
              <div className="flex items-center gap-[var(--px-22)] mr-[var(--px-5)]">
                <IconButton
                  text="Rename"
                  transparent={true}
                  customWidth="min-w-[var(--px-70)]"
                  mobile={true}
                  onClick={() => setShowRename(true)}
                  icon={<img src={RenameSvg} draggable={false} alt="Rename" aria-label="Rename" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  hoverIcon={<img src={RenameBlackSvg} draggable={false} alt="Rename" aria-label="Rename" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  className="playlist-action-button"
                  id="playlist-hero-rename-button"
                />
              </div>
              <div className="flex items-center gap-[var(--px-12)] mr-[var(--px-2)]">
                <IconButton
                  text="Rate Playlist"
                  transparent={true}
                  customWidth="min-w-[var(--px-80)]"
                  mobile={true}
                  onClick={() => setShowRating(true)}
                  icon={<img src={StarSvg} draggable={false} aria-label="Star" alt="Star" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  hoverIcon={<img src={StarBlackSvg} aria-label="Star" alt="Star" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  className="playlist-rating-button"
                  id="playlist-hero-rating-button"
                />
                <IconButton
                  text="Share"
                  transparent={true}
                  customWidth="min-w-[var(--px-70)]"
                  mobile={true}
                  onClick={() => setShowShare(true)}
                  icon={<img src={ShareSvg} draggable={false} alt="Share" aria-label="Share" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  hoverIcon={<img src={ShareBlackSvg} draggable={false} alt="Share" aria-label="Share" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                  className="playlist-action-button"
                  id="playlist-hero-share-button"
                />
              </div>
            </div>
          </div>
          <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
            <div className="flex flex-col">
              <div className="flex items-start gap-[var(--px-10)]">
                <div className="flex flex-col items-start gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 h-[var(--px-50)] w-[var(--px-50)]">
                    {!DEMO_MODE && uploadedCoverArt ? (
                      <img src={uploadedCoverArt} draggable={false} aria-label="Track Cover" alt="Track Cover" className="w-[var(--px-50)] h-[var(--px-50)] object-cover" />
                    ) : (
                      <img src={TrackSvg} draggable={false} alt="Track Cover" aria-label="Track Cover" className="w-[var(--px-50)] h-[var(--px-50)]" />
                    )}
                  </div>
                </div>
                <div className="flex flex-col w-full gap-[var(--px-40)] max-w-[var(--px-250)]">
                  <div className="flex flex-col justify-between min-h-[var(--px-55)]">
                    <h1 className="text-[length:var(--px-13)] font-light uppercase font-helvetica leading-[var(--px-14)]">
                      <HoverFlow
                        text={playlistData?.playlist.name || ''}
                        maxChars={26}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="210px"
                      />
                    </h1>
                    <div className={`text-[length:var(--px-9)] lg:text-[length:var(--px-7)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-10)] ${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist.name ? 'hidden' : ''}`}>
                      {/* Display only if default is changed */}
                      <HoverFlow
                        text={playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title}
                        maxChars={45}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="210px"
                      />
                    </div>
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-9)] lg:text-[length:var(--px-7)] font-light font-fira leading-[var(--px-9)] items-center">
                      <img src={TimeSvg} draggable={false} alt="Time" aria-label="Time" className="w-[var(--px-8)] h-[var(--px-8)]" />
                      <div>{playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.year}</div>
                      <div>|</div>
                      <div className="truncate max-w-[var(--px-130)]">{playlistData?.queried_track.label}</div>
                      <button
                        type="button"
                        onClick={() => setShowMeta((v) => !v)}
                        aria-label={showMeta ? "Hide Meta Info" : "Show Meta Info"}
                        aria-expanded={showMeta}
                        className="hover:cursor-pointer playlist-meta-toggle ml-auto"
                        id="playlist-hero-meta-toggle"
                      >
                        <img draggable={false} src={InfoSvg} alt="" aria-hidden="true" className="w-[var(--px-18)] lg:w-[var(--px-14)] h-[var(--px-18)] lg:h-[var(--px-14)]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
                <div className={`gap-[var(--px-8)] mt-[var(--px-6)] ${showMeta ? 'flex' : 'hidden'}`}>
                  <div className="inline-flex py-[var(--px-4)] w-[var(--px-50)] rounded-3xl justify-center items-center bg-[var(--color-secondary-background)] text-[length:var(--px-6)] tracking-[var(--px-0-25)] font-light font-fira uppercase select-none text-[#5C5C5C]">Input Track</div>
                  <div className="py-[var(--px-4)] px-[var(--px-8)] rounded-3xl inline-flex justify-center items-center gap-[var(--px-4)] bg-[var(--color-secondary-background)] text-[length:var(--px-6)] tracking-[var(--px-0-25)] font-light font-fira uppercase select-none text-white">
                    {playlistData?.playlist.is_public ? (
                      <>
                        <PublicIcon customWidth="8" customHeight="8" className="text-white" disableHover={true} />
                        Public
                      </>
                    ) : (
                      <>
                        <PrivateIcon customWidth="8" customHeight="8" className="text-white" disableHover={true} />
                        Private
                      </>
                    )}
                  </div>
                </div>
              <div className="flex flex-col gap-[var(--px-10)]">
                {/* Hidden Meta Info */}
                <div className={`flex gap-[var(--px-2)] text-[length:var(--px-7)] lg:text-[length:var(--px-5-5)] my-[var(--px-5)] font-light font-fira leading-[var(--px-7)] items-center ${showMeta ? '' : 'hidden'}`}>
                  <div className="truncate max-w-[var(--px-50)]">ID: {playlistData?.queried_track.id}</div>
                  <div>|</div>
                  <div>Status: {InputTrackStatus}</div>
                  <div>|</div>
                  <div>Mode: Independent</div>
                  <div>|</div>
                  <div>Instance: Input Track</div>
                </div>
                {/* The actual Input player */}
                <InputPlayer
                  trackId={playlistData?.queried_track.id || ''}
                  totalDuration={playlistData?.queried_track.duration ?? 0}
                  playButtonDataAttributes={{
                    'data-testid': 'play-button',
                    'data-track-id': playlistData?.queried_track.id || '',
                    'data-track-artist': playlistData?.queried_track.artist || '',
                    'data-track-title': playlistData?.queried_track.title || '',
                    'data-track-name': playlistData?.queried_track.title || '',
                  }}
                />
              </div>
            </div>
            <div className="absolute right-[var(--px-16)] top-[var(--px-16)] select-none text-[#5C5C5C]">
              <button
                type="button"
                onClick={() => onMoreClick?.(
                  playlistData?.queried_track.id || '',
                  playlistData?.playlist.name || '',
                  playlistData?.queried_track.label || '',
                  playlistData?.queried_track.duration ?? 0,
                  null,
                  true
                )}
                className="cursor-pointer playlist-more-button"
                id={`playlist-hero-more-${playlistData?.queried_track.id || ''}`}
                aria-label="More options"
              >
                <img src={MoreSvg} draggable={false} alt="" aria-hidden="true" className="w-[var(--px-19)] h-[var(--px-14)]" />
              </button>
            </div>
          </div>
        </div>
        <img src={AngleDownSvg} draggable={false} alt="arrow_down" aria-hidden="true" loading="lazy" className="w-[var(--px-50)] h-[var(--px-50)] my-[var(--px-40)]" />
        <div className="text-[var(--color-text-secondary)] text-[length:var(--px-20)] font-light font-helvetica uppercase">SONIC MATCH FOUND</div>
      </div>

      {/* Modals */}
      <PlaylistRating
        isOpen={showRating}
        onClose={handleRatingClose}
        onStatusChange={handleStatusChange}
      />
      <PlaylistShare isOpen={showShare} onClose={() => setShowShare(false)} id={playlistData?.playlist.id || ''} />
      <PlaylistRename
        isOpen={showRename}
        onClose={handleRenameClose}
        onStatusChange={handleStatusChange}
      />

      {/* Status Message */}
      <StatusMessage
        isOpen={showStatus}
        onClose={handleStatusClose}
        status={statusType}
        message={statusMessage}
        title={statusTitle}
      />
    </div>
  );
};

export default PlaylistHero;
