import React from "react";
import ArrowSmallUp from "../assets/icons/arrow_small_up.svg";
import ReferenceSvg from "../assets/icons/reference.svg";
import AnalysisSvg from "../assets/icons/analysis.svg";
import MatchesSvg from "../assets/icons/matches.svg";

const SectionFour: React.FC = () => (
  <div className='mt-[350px] px-[45px]'>
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
        <div className='mt-16'>
          <svg xmlns="http://www.w3.org/2000/svg" width="308" height="171" viewBox="0 0 308 171" fill="none">
            <path d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z" stroke="white" stroke-width="0.37037" stroke-dasharray="0.74 0.74" />
          </svg>
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
        <div className=''>
          -------------------------
        </div>
        <div className='flex justify-between items-start mr-4'>
          <div className='flex flex-col justify-between gap-6 items-start'>
            <img src={AnalysisSvg} alt="Analysis" />
            <div className='text-[22px] font-bold font-helvetica uppercase'>
              2 — Deep Sonic Analysis
            </div>
            <div className='text-[17px] font-extralight font-auger opacity-70 leading-5'>
              Here's when the magic happens.<br />Our system performs a full spectral<br />analysis on a granular level,<br />exploring every aspect of your tune:<br />rhythm, harmonic content, energy <br />flow, dynamics, and tonal balance.
            </div>
          </div>
          <div className=''>
            |<br />|<br />|<br />|<br />
          </div>
          <div className='flex flex-col justify-between gap-6 items-start'>
            <img src={MatchesSvg} alt="Matches" />
            <div className='text-[22px] font-bold font-helvetica uppercase'>
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
