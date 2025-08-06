import React, { useRef } from "react";
import ArrowDownRightSvg from "../../../assets/icons/arrow_down_right.svg";
import ReferenceSvg from "../../../assets/icons/reference.svg";
import AnalysisSvg from "../../../assets/icons/analysis.svg";
import MatchesSvg from "../../../assets/icons/matches.svg";
// import { SineWaves, CodeTyping, ButtonHeavyRight } from "@resomix/ui";
import { ButtonHeavyRight } from "@resomix/ui";
// import { useOnScreen } from "@resomix/hooks";

const HomeFour: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");
  return (
    <div ref={sectionRef} className='mt-[var(--px-200)] relative z-15'>
      <div className='flex flex-col gap-[var(--px-40)]'>
        <div className='flex flex-col text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)]'>
          <div className='flex items-center justify-start'>
            <div className='mr-[var(--px-8)]'>
              HOW
            </div>
            <img className="w-[var(--px-33)] h-[var(--px-33)] -mt-[var(--px-2)]" src={ArrowDownRightSvg} alt="Arrow Small Up" />
          </div>
          <div className=''>
            RESOMIX<br />WORKS
          </div>
        </div>
        <div className='flex flex-col items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img src={ReferenceSvg} alt="Reference" className="mb-[var(--px-4)] mr-[var(--px-12)] w-[var(--px-52)] h-[var(--px-52)]" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              1 — Upload Your<br />Reference Track
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            You can upload any audio file: a released or unreleased track, a sketch from your archive, or a short clip. Metadata is not important; Resomix listens to your reference audio and extrapolates its sonic DNA to find a perfect match.
          </div>
        </div>
        <div className='flex flex-col justify-between mb-[var(--px-16)] items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img className="w-[var(--px-58)] h-[var(--px-60)] mr-[var(--px-12)] mb-[var(--px-4)]" src={AnalysisSvg} alt="Analysis" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              2 — Deep Sonic<br />Analysis
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            Here's when the magic happens. Our system performs a full spectral analysis on a granular level, exploring every aspect of your tune rhythm, harmonic content, energy flow, dynamics, and tonal balance.
          </div>
        </div>
        <div className='flex flex-col justify-between mb-[var(--px-16)] items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img className="w-[var(--px-52)] h-[var(--px-52)] mr-[var(--px-12)] mb-[var(--px-4)]" src={MatchesSvg} alt="Matches" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              3 — Get Perfect<br />Matches
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            Within seconds, you'll have a carefully crafted selection of tracks that resonate with your reference's vibe, regardless of genre, release date, or popularity.
          </div>
        </div>
        <div>
          <ButtonHeavyRight className="w-full mx-[var(--px-2)]" text="Upload Your Track" onClick={() => { }} />
        </div>

        {/* SVG frame with Sinewave, commented out for now */}

        {/* <div className='flex mt-[var(--px-150)] flex-col w-full min-h-[var(--px-245)]'>
          <div className='text-[length:var(--px-9)] font-light font-fira tracking-widest leading-[var(--px-10)] mb-[var(--px-4)] ml-[var(--px-1)] min-h-[var(--px-16)]'>
            <CodeTyping
              speed={25}
              text="search_now()<br />// lightning_fast.query()"
              multiline={true}
            />
          </div>
          <div className='text-[length:var(--px-9)] font-light font-fira -mb-[var(--px-32)] tracking-widest ml-[var(--px-1)] min-h-[var(--px-10-5)]'>
            <CodeTyping
              speed={50}
              text="Resomix.run[...]"
              delay={2200}
            />
          </div>

          <div className="relative w-[var(--px-393)] h-[var(--px-220)]">
            <svg
              viewBox="0 0 308 171"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full pointer-events-none"
            >
              <defs>
                <clipPath id="cubeClip" clipPathUnits="objectBoundingBox">
                  <path transform="scale(0.003246753,0.005847953)" d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z" />
                </clipPath>
              </defs>

              <path
                d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z"
                stroke="white"
                strokeWidth="0.37037"
                strokeDasharray="0.74 0.74"
                fill="none"
              />
            </svg>

            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ clipPath: "url(#cubeClip)", WebkitClipPath: "url(#cubeClip)" }}
            >
              <div className="w-full h-[var(--px-275)] mt-[var(--px-20)]">
                {isVisible && <SineWaves />}
              </div>
            </div>
          </div>

          <div className='text-[length:var(--px-9)] font-light font-fira tracking-widest leading-[var(--px-10)] ml-[var(--px-1)]'>
            <CodeTyping
              speed={25}
              text="deep_sonic_analysis [mode=granular]<br />system.listens(...)"
              multiline={true}
            />
          </div>
        </div> */}
      </div>
    </div>
  );
};

export default HomeFour;
