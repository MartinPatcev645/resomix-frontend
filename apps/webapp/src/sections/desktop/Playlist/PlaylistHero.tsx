import React from "react";
import { IconButton, HoverFlow } from "@resomix/ui";
import { formatDuration } from "@resomix/hooks";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";
import AngleLeftSvg from "@/assets/icons/angle_left.svg";
import StarSvg from "@/assets/icons/star.svg";
import TrackSvg from "@/assets/icons/track_2.svg";
import TimeSvg from "@/assets/icons/time.svg";

// Add a javascript object here to create data for the playlist result
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
      "name": "Gregor Tresher, Petar Dundov - Ursa Minor (Marcel Dettmann Remix)"
    }
  }
}


const PlaylistHero: React.FC = () => {
  return (
    <div className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1152 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-[length:var(--px-1152)] h-[length:var(--px-628)] pointer-events-none z-10"
      >
        <defs>
          <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
            <path transform="scale(0.0008680556,0.0015923567)" d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" />
          </clipPath>
        </defs>

        {/* stroke outline */}
        <path
          d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z"
          stroke="white"
          strokeOpacity="1"
          strokeWidth="1"
          strokeDasharray="0.74 0.74"
          fill="none"
        />
      </svg>

      {/* Clip content inside shape */}
      <div
        className="relative w-[var(--px-1152)] h-[var(--px-628)] mx-auto z-20"
        style={{
          clipPath: "url(#heroClip)",
          WebkitClipPath: "url(#heroClip)"
        }}
      >
        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col items-center justify-between w-full h-full select-none py-[var(--px-55)]">
          <div></div>
          <div className="flex flex-col w-[var(--px-700)]">
            <div className="flex w-full justify-between">
              <div onClick={() => { }} className="flex text-[length:var(--px-9)] font-light font-fira gap-[var(--px-8)] items-center hover:underline hover:cursor-pointer">
                <img src={AngleLeftSvg} alt="Angle Left" className="w-[var(--px-13)] h-[var(--px-13)]" />
                Generate track similarity
              </div>
              <div className="flex items-center gap-[var(--px-8)]">
                <IconButton
                  text="Rename"
                  transparent={true}
                  customWidth="min-w-[var(--px-120)]"
                  onClick={() => { }}
                  icon={<img src={RenameSvg} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                  hoverIcon={<img src={RenameBlackSvg} alt="Rename" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                />
                <IconButton
                  text="Share"
                  transparent={true}
                  customWidth="min-w-[var(--px-120)]"
                  onClick={() => { }}
                  icon={<img src={ShareSvg} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                  hoverIcon={<img src={ShareBlackSvg} alt="Share" className="w-[var(--px-16)] h-[var(--px-16)]" />}
                />
              </div>
            </div>
            <div className="relative border border-dotted border-slate-200 p-[var(--px-20)] h-full w-full">
              <div className="flex items-start gap-[var(--px-30)]">
                <div className="flex flex-col items-center gap-[var(--px-10)]">
                  <div className="border border-dotted border-slate-200 p-[var(--px-20)]">
                    <img src={TrackSvg} alt="Track" className="w-[var(--px-90)] h-[var(--px-90)]" />
                  </div>
                  <div className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] p-[var(--px-10)] flex gap-[var(--px-8)] items-end hover:cursor-pointer">
                    <img src={StarSvg} alt="Star" className="w-[var(--px-12)] h-[var(--px-12)] mb-[var(--px-2)]" />
                    <div className="text-[length:var(--px-8)] tracking-[var(--px-0-25)] font-light font-fira text-[var(--color-text-primary)]">Rate This Playlist</div>
                  </div>
                </div>
                <div className="flex flex-col w-full gap-[var(--px-10)] max-w-[var(--px-480)]">
                  <div className="flex flex-col gap-[var(--px-7)]">
                    <div className="text-[length:var(--px-19)] font-light uppercase font-helvetica leading-[var(--px-24)]">
                      <HoverFlow
                        text={PlaylistResult.data.playlist.name}
                        maxChars={40}
                        delay={50}
                        speed={80}
                        endPause={1000}
                        maxWidth="430px"
                      />
                    </div>
                    <div className={`text-[length:var(--px-9)] font-light tracking-[var(--px-0-1)] font-fira leading-[var(--px-14)] ${(PlaylistResult.data.queried_track.artist + ' - ' + PlaylistResult.data.queried_track.title) === PlaylistResult.data.playlist.name ? 'hidden' : ''}`}>
                      {/* Display only if default is changed */}
                      {PlaylistResult.data.queried_track.artist} - {PlaylistResult.data.queried_track.title}
                    </div>
                    <div className="flex gap-[var(--px-5)] tracking-[var(--px-0-1)] text-[length:var(--px-9)] font-light font-fira leading-[var(--px-14)] items-center">
                      <img src={TimeSvg} alt="Time" className="w-[var(--px-10)] h-[var(--px-10)]" />
                      <div>{formatDuration(PlaylistResult.data.queried_track.duration)}</div>
                      <div>|</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-[var(--px-10)]">Okay</div>
                </div>
              </div>
              <div className="absolute right-0 top-0">Input Track</div>
            </div>
          </div>
          <div className="text-[var(--color-text-secondary)] text-[length:var(--px-19)] font-light font-helvetica uppercase">SIMILAR TRACKS FOUND</div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistHero;
