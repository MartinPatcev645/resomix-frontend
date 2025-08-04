import React from "react";
import { Remains, IconComp } from "@resomix/ui";
// import { BackgroundNoise } from "../components/index.ts";
import XSvg from "../assets/icons/twitter_x.svg";
import InstaSvg from "../assets/icons/instagram.svg";
import FbSvg from "../assets/icons/facebook.svg";
import SoundWaves from "../assets/icons/sound_waves.svg";
import ArrowSmallDown from "../assets/icons/arrow_small_down.svg";

const HeroSection: React.FC = () => (
  <div className="relative">
    {/* Hidden SVG defs for clip-path */}
    <svg
      viewBox="0 0 314 718"
      preserveAspectRatio="none"
      className="absolute inset-0 w-[length:var(--px-314)] h-[length:var(--px-718)] mx-[var(--px-40)] -mt-[var(--px-8)] pointer-events-none z-10"
    >
      <defs>
        <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
          <path transform="scale(0.0031847134,0.0013927577)" d="M267.893 0.348633H314V716.849H267.893L242.444 690.833H81.9099L56.461 716.849H0.5V0.348633H56.461L81.9099 25.1167H242.444L267.893 0.348633Z" />
        </clipPath>
      </defs>

      {/* stroke outline */}
      <path
        d="M267.893 0.348633H314V716.849H267.893L242.444 690.833H81.9099L56.461 716.849H0.5V0.348633H56.461L81.9099 25.1167H242.444L267.893 0.348633Z"
        stroke="white"
        strokeOpacity="0.7"
        strokeWidth="0.37037"
        strokeDasharray="0.74 0.74"
        fill="none"
      />
    </svg>

    {/* Clip content inside shape */}
    <div
      className="relative w-[var(--px-314)] h-[var(--px-718)] mx-auto z-20"
      style={{
        clipPath: "url(#heroClip)",
        WebkitClipPath: "url(#heroClip)"
      }}
    >
      {/* Background noise layers (two, for consistency with other sections) */}
      {/* <BackgroundNoise zIndex={1} opacity={0.8} /> */}

      {/* Remains background animation */}
      <div className="absolute inset-0 w-[var(--px-314)] h-[var(--px-718)] mx-[var(--px-40)] -mt-[var(--px-8)]">
        <Remains />
      </div>

      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-end justify-between w-[var(--px-314)] h-full select-none mx-[var(--px-40)] -mt-[var(--px-8)]">
        <div className="flex flex-col text-start my-auto w-full relative z-15">
          <div className="justify-start text-[length:var(--px-40)] font-bold font-helvetica uppercase leading-[var(--px-40)]" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>Resomix<br />— the Soul<br />of Sound </div>
          <div className="justify-start text-[length:var(--px-16)] font-light font-helvetica uppercase mt-[var(--px-10)]" style={{ textShadow: "0 4px 10px rgba(0,0,0,0.6)" }}>A deep learning platform<br />that helps DJs discover tracks<br />by feeling, not by genre.</div>
          <img className="w-[var(--px-34)] h-[var(--px-34)] mt-[var(--px-10)]" style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.6))" }} src={ArrowSmallDown} alt="Arrow Small Down" />
        </div>
        <div className="flex gap-[var(--px-4)] mx-auto mb-[var(--px-40)] relative z-15">
          <IconComp
            svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={FbSvg} alt="Fb" />}
            className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://www.facebook.com/resomix", "_blank")}
          />
          <IconComp
            svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={InstaSvg} alt="Insta" />}
            className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://www.instagram.com/resomix", "_blank")}
          />
          <IconComp
            svg={<img className="w-[var(--px-23)] h-[var(--px-23)]" src={XSvg} alt="X" />}
            className="w-[var(--px-23)] h-[var(--px-23)] px-[var(--px-5)]"
            padding=""
            onClick={() => window.open("https://twitter.com/resomix", "_blank")}
          />
        </div>
      </div>
    </div>

    {/* Text below the SVG clip path */}
    <div className='flex justify-center items-center gap-[var(--px-8)] relative z-15 mt-[var(--px-40)]'>
      <div className="text-right justify-start text-[length:var(--px-16)] font-extralight font-helvetica uppercase leading-[var(--px-16)]">Unbounded by trends,<br />built for emotional<br />resonance</div>
      <img src={SoundWaves} className="w-[var(--px-31)] h-[var(--px-38)]" alt="Sound Waves" />
    </div>
  </div>
);

export default HeroSection;
