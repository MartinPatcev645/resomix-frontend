import React from "react";
import { IconButton } from "@resomix/ui";
import RenameSvg from "@/assets/icons/rename.svg";
import RenameBlackSvg from "@/assets/icons/rename_black.svg";
import ShareSvg from "@/assets/icons/share.svg";
import ShareBlackSvg from "@/assets/icons/share_black.svg";

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
              <div className="flex">
                <img src="" alt="" />
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
            <div className="">
              <div className="flex">
                <div className="">Okay</div>
                <div className="">Okay</div>
              </div>
              <div className="absolute for input track label">Okay</div>
            </div>
          </div>
          <div className="text-[var(--color-text-secondary)] text-[length:var(--px-19)] font-light font-helvetica uppercase">SIMILAR TRACKS FOUND</div>
        </div>
      </div>
    </div>
  );
};

export default PlaylistHero;
