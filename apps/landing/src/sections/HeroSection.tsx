import React from "react";
import { FlyingThroughSpace, IconComp } from "@resomix/ui";
import XSvg from "../assets/icons/x.svg";
import InstaSvg from "../assets/icons/instagram.svg";
import FbSvg from "../assets/icons/fb.svg";
import SoundWaves from "../assets/icons/sound waves.svg";
import ArrowSmallDown from "../assets/icons/arrow small down.svg";

const HeroSection: React.FC = () => (
  <div className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg
      viewBox="0 0 1153 628"
      preserveAspectRatio="none"
      className="absolute inset-0 w-[length:var(--px-1153)] h-[length:var(--px-628)] mx-[var(--px-63)] pointer-events-none z-10"
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
      className="relative w-[var(--px-1153)] h-[var(--px-628)] mx-auto"
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
            <div className='flex gap-[var(--px-12)]'>
              <img src={ArrowSmallDown} alt="Arrow Small Down" />
              <div className="justify-start text-[length:var(--px-17)] font-normal font-helvetica uppercase leading-5">A deep learning platform that helps DJs <br />discover tracks by feeling, not by genre. </div>
            </div>
            <div className="text-[length:var(--px-59)] font-medium font-helvetica uppercase">the Soul of Sound</div>
          </div>
        </div>
        <div className="flex gap-[var(--px-4)] mr-[var(--px-8)] mb-[var(--px-8)] relative z-15">
          <IconComp
            svg={
              <img src={FbSvg} alt="Fb" />
            }
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="var(--px-24)"
            height="var(--px-24)"
          />
          <IconComp
            svg={
              <img src={InstaSvg} alt="Insta" />
            }
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="var(--px-24)"
            height="var(--px-24)"
          />
          <IconComp
            svg={
              <img src={XSvg} alt="X" />
            }
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="var(--px-24)"
            height="var(--px-24)"
          />
        </div>
      </div>
    </div>

    {/* Text below the SVG clip path */}
    <div className='flex justify-center items-center gap-[var(--px-8)] relative z-15'>
      <div className="text-right justify-start text-[length:var(--px-18)] font-light font-helvetica uppercase leading-5">Unbounded by trends,<br />built for emotional resonance</div>
      <img src={SoundWaves} className="w-[var(--px-38)] h-[var(--px-31)]" alt="Sound Waves" />
    </div>
  </div>
);

export default HeroSection;