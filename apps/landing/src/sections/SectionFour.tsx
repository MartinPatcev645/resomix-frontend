import React from "react";
import ArrowSmallUp from "../assets/icons/arrow_small_up.svg";
import ReferenceSvg from "../assets/icons/reference.svg";
import AnalysisSvg from "../assets/icons/analysis.svg";
import MatchesSvg from "../assets/icons/matches.svg";
import LineOneSvg from "../assets/icons/line1.svg";
import LineTwoSvg from "../assets/icons/line2.svg";
import RingsShow from "../assets/gifs/rings_show.gif";

const SectionFour: React.FC = () => (
  <div className='mt-[300px] px-[65px] relative z-15'>
    <div className='flex justify-between'>
      <div className='flex flex-col justify-between h-full items-center'>
        <div className='flex flex-col text-[65px] font-bold font-helvetica uppercase leading-16'>
          <div className='flex items-center justify-start'>
            <div className='mr-4'>
              HOW
            </div>
            <img src={ArrowSmallUp} alt="Arrow Small Up" />
          </div>
          <div className=''>
            RESOMIX<br />WORKS
          </div>
        </div>
        <div className='mt-16 flex flex-col'>
          <div className='text-[7px] font-light font-fira tracking-widest leading-2 mb-1 opacity-60'>
            search_now()<br />// lightning_fast.query()
          </div>
          <div className='text-[7px] font-light font-fira -mb-8 tracking-widest opacity-60'>
            Resomix.run[...]
          </div>
          
          {/* Hidden SVG defs for clip-path */}
          <svg className="absolute w-0 h-0">
            <defs>
              <clipPath id="sectionFourClip">
                <path d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z" />
              </clipPath>
            </defs>
          </svg>

          {/* Container for clip path and overlay */}
          <div className="relative w-[308px] h-[171px]">
            {/* Clip content inside shape */}
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                clipPath: "url(#sectionFourClip)",
                WebkitClipPath: "url(#sectionFourClip)"
              }}
            >
              {/* Purple animation background */}
              <img 
                src={RingsShow} 
                alt="Purple Animation" 
                className="w-[90%] object-contain my-auto mx-auto absolute inset-0"
              />
            </div>

            {/* Original SVG overlay for the stroke effect */}
            <svg xmlns="http://www.w3.org/2000/svg" width="308" height="171" viewBox="0 0 308 171" fill="none" className="absolute inset-0">
              <path d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z" stroke="white" stroke-width="0.37037" stroke-dasharray="0.74 0.74" />
            </svg>
          </div>
          
          <div className='text-[7px] font-light font-fira tracking-widest leading-2 mt-1 opacity-60'>
            deep_sonic_analysis [mode=granular]<br />system.listens(...)
          </div>
        </div>
      </div>
      <div className='flex flex-col'>
        <div className='flex flex-col items-start mr-4'>
          <div className='flex items-end justify-start gap-5 mb-4'>
            <img src={ReferenceSvg} alt="Reference" className="mb-1 mr-3" />
            <div className='text-[22px] font-bold font-helvetica uppercase'>
              1 — Upload Your Reference Track
            </div>
          </div>
          <div className='text-[17px] font-extralight font-auger opacity-70 leading-5 my-2'>
            You can upload any audio file: a released or unreleased track, a sketch<br />from your archive, or a short clip.Metadata is not important; Resomix<br />listens to your reference audio and extrapolates its sonic DNA to find<br />a perfect match.
          </div>
        </div>
        <div className='mt-3 mb-8 opacity-50'>
          <img src={LineOneSvg} alt="Line One" />
        </div>
        <div className='flex justify-between items-start mr-4'>
          <div className='flex flex-col justify-between gap-2 items-start'>
            <img src={AnalysisSvg} alt="Analysis" />
            <div className='text-[22px] mb-4 font-bold font-helvetica uppercase'>
              2 — Deep Sonic Analysis
            </div>
            <div className='text-[17px] font-extralight font-auger opacity-70 leading-5'>
              Here's when the magic happens.<br />Our system performs a full spectral<br />analysis on a granular level,<br />exploring every aspect of your tune:<br />rhythm, harmonic content, energy <br />flow, dynamics, and tonal balance.
            </div>
          </div>
          <div className=''>
            <img src={LineTwoSvg} alt="Line Two" />
          </div>
          <div className='flex flex-col justify-between gap-2 items-start'>
            <img src={MatchesSvg} alt="Matches" />
            <div className='text-[22px] mb-4 font-bold font-helvetica uppercase'>
              3 — Get Perfect Matches
            </div>
            <div className='text-[17px] font-extralight font-auger opacity-70 leading-5'>
              Within seconds, you'll have a<br />carefully crafted selection of<br />tracks that resonate with your<br />reference's vibe, regardless of<br />genre, release date, or<br />popularity.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default SectionFour;
