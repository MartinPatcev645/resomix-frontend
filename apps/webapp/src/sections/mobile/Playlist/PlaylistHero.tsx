import React from "react";
import { IconButton, HoverFlow } from "@resomix/ui";
import { formatDuration } from "@resomix/hooks";
import { usePlaylistStore } from "@resomix/stores";
import { InputPlayer, PlaylistRating, PlaylistShare, PlaylistRename, StatusMessage } from "@/components/index.ts";
import { usePlayerStore } from "@resomix/stores";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";
import StarSvg from "@/assets/icons/star_white.svg";
import MoreSvg from "@/assets/icons/more.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import TimeSvg from "@/assets/icons/time.svg";
import InfoSvg from "@/assets/icons/info.svg";
import { BASE_BETA_URL } from "@resomix/config";

const InputTrackStatus = "Loading..."

interface PlaylistHeroProps {
  onMoreClick?: (trackId: string) => void;
}

const PlaylistHero: React.FC<PlaylistHeroProps> = ({ onMoreClick }) => {
  const [showMeta, setShowMeta] = React.useState(false);
  const [showRating, setShowRating] = React.useState(false);
  const [showShare, setShowShare] = React.useState(false);
  const [showRename, setShowRename] = React.useState(false);
  const [showStatus, setShowStatus] = React.useState(false);
  const [statusType, setStatusType] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = React.useState('');

  const { playlistData } = usePlaylistStore();
  const { uploadedUrl } = usePlayerStore();

  const handleStatusChange = (type: 'loading' | 'success' | 'error', message: string) => {
    setStatusType(type);
    setStatusMessage(message);
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
            <div onClick={() => { window.location.href = BASE_BETA_URL }} className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline hover:cursor-pointer">
              <img src={AngleLeftSvg} alt="Angle Left" className="w-[var(--px-20)] h-[var(--px-20)]" />
            </div>
            <div className="flex items-center gap-[var(--px-8)]">
              <IconButton
                text="Rename"
                transparent={true}
                customWidth="min-w-[var(--px-70)]"
                mobile={true}
                onClick={() => setShowRename(true)}
                icon={<img src={RenameSvg} alt="Rename" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                hoverIcon={<img src={RenameBlackSvg} alt="Rename" className="w-[var(--px-12)] h-[var(--px-12)]" />}
              />
              <IconButton
                text="Share"
                transparent={true}
                customWidth="min-w-[var(--px-70)]"
                mobile={true}
                onClick={() => setShowShare(true)}
                icon={<img src={ShareSvg} alt="Share" className="w-[var(--px-12)] h-[var(--px-12)]" />}
                hoverIcon={<img src={ShareBlackSvg} alt="Share" className="w-[var(--px-12)] h-[var(--px-12)]" />}
              />
              <IconButton
                text="Rate Playlist"
                transparent={true}
                customWidth="min-w-[var(--px-80)]"
                mobile={true}
                onClick={() => setShowRating(true)}
                icon={<img src={StarSvg} alt="Star" className="w-[var(--px-12)] h-[var(--px-12)]" />}
              />
            </div>
          </div>
          <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
            <div className="flex flex-col">
              <div className="flex items-start gap-[var(--px-10)]">
                <div className="flex flex-col items-center gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 h-[var(--px-50)] w-[var(--px-50)]">
                    <img src={TrackSvg} alt="Track" className="w-[var(--px-50)] h-[var(--px-50)]" />
                  </div>
                  <div className={`py-[var(--px-4)] w-[var(--px-50)] rounded-3xl justify-center items-center bg-[var(--color-secondary-background)] text-[length:var(--px-6)] tracking-[var(--px-0-25)] font-light font-fira uppercase select-none text-[#5C5C5C] ${showMeta ? 'inline-flex' : 'hidden'}`}>Input Track</div>
                </div>
                <div className="flex flex-col w-full gap-[var(--px-40)] max-w-[var(--px-250)]">
                  <div className="flex flex-col justify-between min-h-[var(--px-55)]">
                    <div className="text-[length:var(--px-13)] font-light uppercase font-helvetica leading-[var(--px-11)]">
                      <HoverFlow
                        text={playlistData?.playlist.name || ''}
                        maxChars={26}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="210px"
                      />
                    </div>
                    <div className={`text-[length:var(--px-7)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-10)] ${(playlistData?.queried_track.artist + ' - ' + playlistData?.queried_track.title) === playlistData?.playlist.name ? 'hidden' : ''}`}>
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
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-7)] font-light font-fira leading-[var(--px-9)] items-center">
                      <img src={TimeSvg} alt="Time" className="w-[var(--px-8)] h-[var(--px-8)]" />
                      <div>{playlistData?.queried_track.duration ? formatDuration(Math.floor(playlistData.queried_track.duration)) : '--:--'}</div>
                      <div>|</div>
                      <div>{playlistData?.queried_track.year}</div>
                      <div>|</div>
                      <div className="truncate max-w-[var(--px-130)]">{playlistData?.queried_track.label}</div>
                      <img onClick={() => setShowMeta((v) => !v)} src={InfoSvg} alt="Info" className="w-[var(--px-14)] h-[var(--px-14)] ml-auto hover:cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-[var(--px-10)]">
                {/* Hidden Meta Info */}
                <div className={`flex gap-[var(--px-2)] text-[length:var(--px-5-5)] my-[var(--px-5)] font-light font-fira leading-[var(--px-7)] items-center ${showMeta ? '' : 'hidden'}`}>
                  <div className="truncate max-w-[var(--px-50)]">ID: {playlistData?.queried_track.id}</div>
                  <div>|</div>
                  <div>Status: {InputTrackStatus}</div>
                  <div>|</div>
                  <div>Mode: Independent</div>
                  <div>|</div>
                  <div>Instance: Input Track</div>
                </div>
                {/* The actual Input player */}
                <InputPlayer trackId={uploadedUrl ? 'uploaded-local' : (playlistData?.queried_track.id || '')} audioUrl={uploadedUrl ?? undefined} />
              </div>
            </div>
            <div className="absolute right-[var(--px-16)] top-[var(--px-16)] select-none text-[#5C5C5C]">
              <div onClick={() => onMoreClick?.(playlistData?.queried_track.id || '')} className="cursor-pointer">
                <img src={MoreSvg} alt="More" className="w-[var(--px-14)] h-[var(--px-10)]" />
              </div>
            </div>
          </div>
        </div>
        <img src={AngleDownSvg} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] my-[var(--px-40)]" />
        <div className="text-[var(--color-text-secondary)] text-[length:var(--px-20)] font-light font-helvetica uppercase">SIMILAR TRACKS FOUND</div>
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
      />
    </div>
  );
};

export default PlaylistHero;
