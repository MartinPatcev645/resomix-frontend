import React from "react";
import { FlyingThroughSpace } from "@resomix/ui";

const HeroSection: React.FC = () => (
  <div className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg className="absolute w-0 h-0">
      <defs>
        <clipPath id="heroClip">
          <path d="M279.222 1.07413H0.333008L0.333336 627.441H279.222L347.74 585.889H779.963L848.481 627.441H1151.81L1151.81 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" stroke="white" stroke-opacity="0.7" stroke-width="0.37037" stroke-dasharray="0.74 0.74" />
        </clipPath>
      </defs>
    </svg>

    {/* Clip content inside shape */}
    <div
      className="relative w-[1152px] h-[628px] mx-auto"
      style={{
        clipPath: "url(#heroClip)",
        WebkitClipPath: "url(#heroClip)"
      }}
    >
      {/* FlyingThroughSpace background animation */}
      <div className="absolute inset-0 w-full h-full">
        <FlyingThroughSpace />
      </div>

      {/* Optional overlay content */}
      <div className="absolute inset-0 flex items-center justify-center text-white z-10">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">ResomiX</h1>
          <p className="text-lg opacity-80">Professional Audio Mixing</p>
        </div>
      </div>
    </div>
  </div>
);

export default HeroSection;
