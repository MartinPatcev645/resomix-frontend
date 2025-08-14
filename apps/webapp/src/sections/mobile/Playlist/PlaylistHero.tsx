import React from "react";
import { IconButton, HoverFlow } from "@resomix/ui";
import { formatDuration } from "@resomix/hooks";
import { InputPlayer, PlaylistRating, PlaylistShare, PlaylistRename, StatusMessage } from "@/components/index.ts";
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

const InputTrackStatus = "Loading..."
const PlaylistResult = {
  "success": true,
  "data": {
    "queried_track": {
      "rank": 0,
      "score": 1.0,
      "id": "1a9983daf38caac5a8e8adaf",
      "title": "Ursa Minor (Marcel Dettmann Remix)",
      "year": 2025,
      "duration": 271,
      "label": "Break New Soil Recordings",
      "artist": "Gregor Tresher, Petar Dundov"
    },
    "similar_tracks": [
      {
        "rank": 1,
        "score": 0.95250189,
        "id": "67adb0d5799206f8d65102a8",
        "title": "Chapter 1",
        "year": 2023,
        "duration": 301,
        "label": "Abstract Mechanisms",
        "artist": "Møntero"
      },
      {
        "rank": 2,
        "score": 0.94865525,
        "id": "67add9769387d00fbdc2dc3d",
        "title": "Opto",
        "year": null,
        "duration": 335,
        "label": "Balance Music",
        "artist": "Etapp Kyle"
      }
    ],
    "playlist": {
      "id": "7b821bef-e168-4511-8525-5e1664b7e483",
      "name": "regor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
    }
  }
}

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

  const handleRenameClose = () => {
    setShowRename(false);
    // Show loading status
    setStatusType('loading');
    setStatusMessage('Renaming playlist...');
    setShowStatus(true);
    
    // After 3 seconds, switch to error
    setTimeout(() => {
      setStatusType('error');
      setStatusMessage('Please Try Again.');
    }, 3000);
  };

  const handleRatingClose = () => {
    setShowRating(false);
    // Show loading status
    setStatusType('loading');
    setStatusMessage('Submitting feedback...');
    setShowStatus(true);
    
    // After 3 seconds, switch to success
    setTimeout(() => {
      setStatusType('success');
      setStatusMessage('Feedback Submitted Successfully!');
    }, 3000);
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
            <div onClick={() => { }} className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline hover:cursor-pointer">
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
                        text={PlaylistResult.data.playlist.name}
                        maxChars={26}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="210px"
                      />
                    </div>
                    <div className={`text-[length:var(--px-7)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-10)] ${(PlaylistResult.data.queried_track.artist + ' - ' + PlaylistResult.data.queried_track.title) === PlaylistResult.data.playlist.name ? 'hidden' : ''}`}>
                      {/* Display only if default is changed */}
                      <HoverFlow
                        text={PlaylistResult.data.queried_track.artist + ' - ' + PlaylistResult.data.queried_track.title}
                        maxChars={45}
                        delay={800}
                        speed={80}
                        endPause={1000}
                        maxWidth="210px"
                      />
                    </div>
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-7)] font-light font-fira leading-[var(--px-9)] items-center">
                      <img src={TimeSvg} alt="Time" className="w-[var(--px-8)] h-[var(--px-8)]" />
                      <div>{formatDuration(PlaylistResult.data.queried_track.duration)}</div>
                      <div>|</div>
                      <div>{PlaylistResult.data.queried_track.year}</div>
                      <div>|</div>
                      <div className="truncate max-w-[var(--px-130)]">{PlaylistResult.data.queried_track.label}</div>
                      <img onClick={() => setShowMeta((v) => !v)} src={InfoSvg} alt="Info" className="w-[var(--px-14)] h-[var(--px-14)] ml-auto hover:cursor-pointer" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-[var(--px-10)]">
                {/* Hidden Meta Info */}
                <div className={`flex gap-[var(--px-2)] text-[length:var(--px-5-5)] my-[var(--px-5)] font-light font-fira leading-[var(--px-7)] items-center ${showMeta ? '' : 'hidden'}`}>
                  <div className="truncate max-w-[var(--px-50)]">ID: {PlaylistResult.data.queried_track.id}</div>
                  <div>|</div>
                  <div>Status: {InputTrackStatus}</div>
                  <div>|</div>
                  <div>Mode: Independent</div>
                  <div>|</div>
                  <div>Instance: Input Track</div>
                </div>
                {/* The actual Input player */}
                <InputPlayer />
              </div>
            </div>
            <div className="absolute right-[var(--px-16)] top-[var(--px-16)] select-none text-[#5C5C5C]">
              <div onClick={() => onMoreClick?.(PlaylistResult.data.queried_track.id)} className="cursor-pointer">
                <img src={MoreSvg} alt="More" className="w-[var(--px-14)] h-[var(--px-10)]" />
              </div>
            </div>
          </div>
        </div>
        <img src={AngleDownSvg} alt="arrow_down" className="w-[var(--px-50)] h-[var(--px-50)] my-[var(--px-40)]" />
        <div className="text-[var(--color-text-secondary)] text-[length:var(--px-20)] font-light font-helvetica uppercase">SIMILAR TRACKS FOUND</div>
      </div>
      
      {/* Modals */}
      <PlaylistRating isOpen={showRating} onClose={handleRatingClose} />
      <PlaylistShare isOpen={showShare} onClose={() => setShowShare(false)} id={PlaylistResult.data?.playlist.id || ''} />
      <PlaylistRename isOpen={showRename} onClose={handleRenameClose} />
      
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
