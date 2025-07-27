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
    <svg className="absolute w-0 h-0">
      <defs>
        <clipPath id="heroClip">
          <path d="M279.222 1.07413H0.333008L0.333336 627.441H279.222L347.74 585.889H779.963L848.481 627.441H1151.81L1151.81 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" stroke="white" strokeOpacity="0.7" strokeWidth="0.37037" strokeDasharray="0.74 0.74" />
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

      {/* Overlay content */}
      <div className="absolute inset-0 flex flex-col items-end justify-between z-15 w-full h-full">
        <div className="flex flex-col text-start my-auto w-full">
          <div className="justify-start text-[133px] font-normal font-helvetica uppercase">Resomix </div>
          <div className='flex w-full justify-between items-center -mt-12'>
            <div className='flex gap-3'>
              <img src={ArrowSmallDown} alt="Arrow Small Down" />
              <div className="justify-start text-[17px] font-normal font-helvetica uppercase leading-5">A deep learning platform that helps DJs <br />discover tracks by feeling, not by genre. </div>
            </div>
            <div className="text-[59px] font-medium font-helvetica uppercase">the Soul of Sound</div>
          </div>
        </div>
        <div className="flex gap-1 mr-2 mb-2">
          <IconComp
            svg={
              <img src={FbSvg} alt="Fb" />
            }
            size="24"
            padding=""
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="24px"
            height="24px"
          />
          <IconComp
            svg={
              <img src={InstaSvg} alt="Insta" />
            }
            size="24"
            padding=""
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="24px"
            height="24px"
          />
          <IconComp
            svg={
              <img src={XSvg} alt="X" />
            }
            size="24"
            padding=""
            backgroundColor="bg-white"
            borderColor="outline-white"
            strokeColor="black"
            width="24px"
            height="24px"
          />
        </div>
      </div>
    </div>

    {/* Text below the SVG clip path */}
    <div className='flex justify-center items-center gap-2'>
      <div className="text-right justify-start text-[18px] font-light font-helvetica uppercase leading-5">Unbounded by trends,<br />built for emotional resonance</div>
      <img src={SoundWaves} className="w-[38px] h-[31px]" alt="Sound Waves" />
    </div>
  </div>
);

export default HeroSection;
