import React, { useRef } from "react";
import { Remains, IconComp } from "@resomix/ui";
import { useOnScreen } from "@resomix/hooks";
// import { BackgroundNoise } from "../components/index.ts";
import XSvg from "../assets/icons/twitter_x.svg";
import InstaSvg from "../assets/icons/instagram.svg";
import FbSvg from "../assets/icons/facebook.svg";
import SoundWaves from "../assets/icons/sound_waves.svg";
import ArrowSmallDown from "../assets/icons/arrow_small_down.svg";

const HeroSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
  <div ref={sectionRef} className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg
      viewBox="0 0 1152 628"
      preserveAspectRatio="none"
      className="absolute inset-0 w-[length:var(--px-1152)] h-[length:var(--px-628)] mx-[var(--px-63)] pointer-events-none z-10"
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
        strokeOpacity="0.7"
        strokeWidth="0.37037"
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
      {/* Background noise layers (two, for consistency with other sections) */}
      {/* <BackgroundNoise zIndex={1} opacity={0.8} /> */}

      {/* FlyingThroughSpace background animation */}
      <div className="absolute inset-0 w-[var(--px-1152)] h-[var(--px-627-5)]">
        {isVisible && <Remains />}
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-end justify-between w-full h-full select-none">
        <div className="flex flex-col text-start my-auto w-full relative z-15">
          <div className="justify-start text-[length:var(--px-133)] font-normal font-helvetica uppercase -ml-[var(--px-10)] text-white" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>Resomix </div>
          <div className='flex w-full justify-between items-center -mt-[var(--px-48)]'>
            <div className='flex gap-[var(--px-12)]'>
              <img className="w-[var(--px-35)] h-[var(--px-35)]" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))" }} src={ArrowSmallDown} alt="Arrow Small Down" />
              <div className="justify-start text-[length:var(--px-16)] font-normal font-helvetica uppercase leading-5 text-white" style={{ textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}>A deep learning platform that helps DJs <br />discover tracks by feeling, not by genre. </div>
            </div>
            <div className="text-[length:var(--px-45)] font-medium font-helvetica uppercase text-white" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>Align With Your Sound</div>
          </div>
        </div>
        <div className="flex gap-[var(--px-4)] mr-[var(--px-8)] mb-[var(--px-8)] relative z-15">
          <IconComp
            svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" src={FbSvg} alt="Fb" />}
            className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://www.facebook.com/resomix", "_blank")}
          />
          <IconComp
            svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" src={InstaSvg} alt="Insta" />}
            className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://www.instagram.com/resomix", "_blank")}
          />
          <IconComp
            svg={<img className="w-[var(--px-24)] h-[var(--px-24)]" src={XSvg} alt="X" />}
            className="w-[var(--px-24)] h-[var(--px-24)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://twitter.com/resomix", "_blank")}
          />
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
};

export default HeroSection;