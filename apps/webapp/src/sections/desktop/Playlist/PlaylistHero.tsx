import React from "react";

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
        <div className="absolute inset-0 flex flex-col justify-center w-full h-full select-none py-auto">
          OKAY
        </div>
      </div>
    </div>
  );
};

export default PlaylistHero;
