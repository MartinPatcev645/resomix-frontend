import React, { useRef } from "react";
import ArrowSmallUp from "@/assets/icons/arrow_small_up.svg";
import ReferenceSvg from "@/assets/icons/reference.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import LineOneSvg from "@/assets/icons/line1.svg";
import LineTwoSvg from "@/assets/icons/line2.svg";
import { SineWaves, CodeTyping, ButtonHeavyRight } from "@resomix/ui";
import { useOnScreen } from "@resomix/hooks";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

const HomeFour: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className='mt-[var(--px-140)] relative z-15'>
      <div className="mb-[var(--px-110)]">
        <div className="w-full flex justify-center items-center">
          <ButtonHeavyRight text="Our Mission" onClick={() => {
            window.location.href = BASE_LANDING_URL + "/about"
          }} link_arrow={true} className="cta-button secondary" id="home-four-mission-button" />
        </div>
      </div>
      <div className='flex justify-between'>
        <div className='flex flex-col justify-between h-full items-center'>
          <div className='flex flex-col text-[length:var(--px-65)] font-bold font-helvetica uppercase leading-[var(--px-64)]'>
            <div className='flex items-center justify-start'>
              <div className='mr-[var(--px-16)]'>
                HOW
              </div>
              <img className="w-[var(--px-49)] h-[var(--px-49)]" aria-hidden="true" loading="lazy" draggable={false} src={ArrowSmallUp} alt="Arrow Small Up" />
            </div>
            <div className=''>
              RESOMIX<br />WORKS
            </div>
          </div>
          <div className='mt-[var(--px-64)] flex flex-col'>
            <div className='text-[length:var(--px-7)] font-light font-fira tracking-widest leading-[var(--px-8)] mb-[var(--px-4)] opacity-60 ml-[var(--px-1)] min-h-[var(--px-16)]'>
              <CodeTyping
                speed={25}
                text="search_now()<br />// lightning_fast.query()"
                multiline={true}
              />
            </div>
            <div className='text-[length:var(--px-7)] font-light font-fira -mb-[var(--px-32)] tracking-widest opacity-60 ml-[var(--px-1)] min-h-[var(--px-10-5)]'>
              <CodeTyping
                speed={25}
                text="Resomix.run[...]"
                delay={2200}
              />
            </div>

            {/* SVG frame with crystalline cube */}
            <div className="relative w-[var(--px-308)] h-[var(--px-171)]">
              {/* Hidden SVG defs for clip-path */}
              <svg
                viewBox="0 0 308 171"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <defs>
                  <clipPath id="cubeClip" clipPathUnits="objectBoundingBox">
                    {/* Scale the path coordinates to object bounding box space */}
                    <path transform="scale(0.003246753,0.005847953)" d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z" />
                  </clipPath>
                </defs>

                {/* Stroke outline */}
                <path
                  d="M132.667 34.8519H0.444336V170.037H307.111V0.777832H174.889L132.667 34.8519Z"
                  stroke="white"
                  strokeWidth="0.37037"
                  strokeDasharray="0.74 0.74"
                  fill="none"
                />
              </svg>

              {/* CrystallineRefraction animation clipped to the frame */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ clipPath: "url(#cubeClip)", WebkitClipPath: "url(#cubeClip)" }}
              >
                {/* Square wrapper to avoid stretching; 85% of frame height for subtle zoom-out */}
                <div className="w-full h-[var(--px-310)] mt-[var(--px-20)]">  {/* ~3:1 aspect inside 308×171 frame */}
                  {isVisible && <SineWaves />}
                </div>
              </div>
            </div>

            <div className='text-[length:var(--px-7)] font-light font-fira tracking-widest leading-[var(--px-8)] opacity-60 ml-[var(--px-1)]'>
              <CodeTyping
                speed={25}
                text="deep_sonic_analysis [mode=granular]<br />system.listens(...)"
                multiline={true}
              />
            </div>
          </div>
        </div>
        <div className='flex flex-col'>
          <div className='flex flex-col items-start'>
            <div className='flex items-end justify-start gap-[var(--px-20)] mb-[var(--px-16)]'>
              <img src={ReferenceSvg} alt="Reference" aria-hidden="true" loading="lazy" draggable={false} className="mb-[var(--px-4)] mr-[var(--px-12)] w-[var(--px-42)] h-[var(--px-42)]" />
              <div className='text-[length:var(--px-22)] font-bold font-helvetica uppercase'>
                1 — Upload Your Reference Track
              </div>
            </div>
            <div className='text-[length:var(--px-17)] font-extralight font-auger opacity-70 leading-[var(--px-20)] my-[var(--px-8)]'>
              You can upload any audio file: a released or unreleased track, a sketch<br />from your archive, or a short clip. Metadata is not important; Resomix<br />listens to your reference audio and extrapolates its sonic DNA to find<br />a perfect match.
            </div>
          </div>
          <div className='mt-[var(--px-12)] mb-[var(--px-32)] opacity-70'>
            <img className="w-[var(--px-763)] h-[var(--px-1)]" aria-hidden="true" loading="lazy" draggable={false} src={LineOneSvg} alt="Line One" />
          </div>
          <div className='flex justify-between items-start mr-[var(--px-16)]'>
            <div className='flex flex-col justify-between gap-[var(--px-8)] items-start'>
              <img className="w-[var(--px-46)] h-[var(--px-48)]" aria-hidden="true" loading="lazy" draggable={false} src={AnalysisSvg} alt="Analysis" />
              <div className='text-[length:var(--px-22)] mb-[var(--px-16)] font-bold font-helvetica uppercase'>
                2 — Deep Sound Analysis
              </div>
              <div className='text-[length:var(--px-17)] font-extralight font-auger opacity-70 leading-[var(--px-20)]'>
                Here's when the magic happens.<br />Our system performs a full spectral<br />analysis on a granular level,<br />exploring every aspect of your tune:<br />rhythm, harmonic content, energy <br />flow, dynamics, and tonal balance.
              </div>
            </div>
            <div className=''>
              <img className="w-[var(--px-1)] h-[var(--px-234)]" aria-hidden="true" loading="lazy" draggable={false} src={LineTwoSvg} alt="Line Two" />
            </div>
            <div className='flex flex-col justify-between gap-[var(--px-8)] items-start'>
              <img className="w-[var(--px-41)] h-[var(--px-41)]" aria-hidden="true" loading="lazy" draggable={false} src={MatchesSvg} alt="Matches" />
              <div className='text-[length:var(--px-22)] mb-[var(--px-16)] font-bold font-helvetica uppercase'>
                3 — Get Perfect Matches
              </div>
              <div className='text-[length:var(--px-17)] font-extralight font-auger opacity-70 leading-[var(--px-20)]'>
                Within seconds, you'll have a<br />carefully crafted selection of<br />tracks that resonate with your<br />reference's vibe, regardless of<br />genre, release date, or<br />popularity.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-[var(--px-40)]">
        <div className="w-full flex justify-end items-center">
          <ButtonHeavyRight text="Get your first match free" onClick={() => {
            window.location.href = BASE_BETA_URL
          }} link_arrow={true} className="cta-button primary" id="home-four-get-match-button" />
        </div>
      </div>
    </div>
  );
};

export default HomeFour;
