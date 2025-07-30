import React from "react";
import { FlyingThroughSpace, IconComp } from "@resomix/ui";
import XSvg from "../assets/icons/x.svg";
import InstaSvg from "../assets/icons/instagram.svg";
import FbSvg from "../assets/icons/fb.svg";
import SoundWaves from "../assets/icons/sound_waves.svg";
import ArrowSmallDown from "../assets/icons/arrow_small_down.svg";

const HeroSection: React.FC = () => (
  <div className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg
      viewBox="0 0 1142 628"
      preserveAspectRatio="none"
      className="absolute inset-0 w-[length:var(--px-1142)] h-[length:var(--px-621)] mx-[var(--px-63)] pointer-events-none z-10"
    >
      <defs>
        <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
          <path transform="scale(0.0008680556,0.0015923567)" d="M279.222 1.07413H0.333008L0.333336 627.441H279.222L347.74 585.889H779.963L848.481 627.441H1151.81L1151.81 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" />
        </clipPath>
      </defs>

      {/* stroke outline */}
      <path
        d="M279.222 1.07413H0.333008L0.333336 627.441H279.222L347.74 585.889H779.963L848.481 627.441H1151.81L1151.81 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="0.37037"
        strokeDasharray="0.74 0.74"
        fill="none"
      />
    </svg>

    {/* Clip content inside shape */}
    <div
      className="relative w-[var(--px-1142)] h-[var(--px-621)] mx-auto"
      style={{
        clipPath: "url(#heroClip)",
        WebkitClipPath: "url(#heroClip)"
      }}
    >
      {/* FlyingThroughSpace background animation */}
      <div className="absolute inset-0 w-full h-full">
        <FlyingThroughSpace />
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-end justify-between w-full h-full">
        <div className="flex flex-col text-start my-auto w-full relative z-15">
          <div className="justify-start text-[length:var(--px-133)] font-normal font-helvetica uppercase">Resomix </div>
          <div className='flex w-full justify-between items-center -mt-[var(--px-48)]'>
            <div className='flex gap-[var(--px-12)] ml-[var(--px-10)]'>
              <img className="w-[var(--px-35)] h-[var(--px-35)]" src={ArrowSmallDown} alt="Arrow Small Down" />
              <div className="justify-start text-[length:var(--px-16)] font-normal font-helvetica uppercase leading-5">A deep learning platform that helps DJs <br />discover tracks by feeling, not by genre. </div>
            </div>
            <div className="text-[length:var(--px-57)] font-medium font-helvetica uppercase mr-[var(--px-10)]">the Soul of Sound</div>
          </div>
        </div>
        <div className="flex gap-[var(--px-4)] mr-[var(--px-8)] mb-[var(--px-8)] relative z-15">
          <img className="w-[var(--px-24)] h-[var(--px-24)]" src={FbSvg} alt="Fb" />
          <img className="w-[var(--px-24)] h-[var(--px-24)]" src={InstaSvg} alt="Insta" />
          <img className="w-[var(--px-24)] h-[var(--px-24)]" src={XSvg} alt="X" />
        </div>
      </div>
    </div>

    {/* Text below the SVG clip path */}
    <div className='flex justify-center items-center gap-[var(--px-8)] relative z-15'>
      <div className="text-right justify-start text-[length:var(--px-18)] font-light font-helvetica uppercase leading-5">Unbounded by trends,<br />built for emotional resonance</div>
      <img src={SoundWaves} className="w-[var(--px-55)] h-[var(--px-44)]" alt="Sound Waves" />
    </div>
  </div>
);

export default HeroSection;