import React, { useRef } from "react";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";
import ReferenceSvg from "@/assets/icons/reference.svg";
import AnalysisSvg from "@/assets/icons/analysis.svg";
import MatchesSvg from "@/assets/icons/matches.svg";
import { ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL, BASE_LANDING_URL } from "@resomix/config";

const HomeFour: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={sectionRef} className='mt-[var(--px-90)] relative z-15'>
      <div className="mb-[var(--px-90)]">
        <div className="w-full flex justify-center items-center">
          <ButtonHeavyRight text="Our Mission" onClick={() => {
            window.location.href = BASE_LANDING_URL + "/about"
          }} link_arrow={true} className="cta-button secondary" id="home-four-mission-button" />
        </div>
      </div>
      <div className='flex flex-col gap-[var(--px-40)]'>
        <div className='flex flex-col text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)]'>
          <div className='flex items-center justify-start'>
            <div className='mr-[var(--px-8)]'>
              HOW
            </div>
            <img className="w-[var(--px-33)] h-[var(--px-33)] -mt-[var(--px-2)]" aria-hidden="true" loading="lazy" draggable={false} src={ArrowDownRightSvg} alt="Arrow Small Up" />
          </div>
          <div className=''>
            RESOMIX<br />WORKS
          </div>
        </div>
        <div className='flex flex-col items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img src={ReferenceSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Reference" className="mb-[var(--px-4)] mr-[var(--px-12)] w-[var(--px-52)] h-[var(--px-52)]" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              1 — Upload Your<br />Reference Track
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            You can upload any audio file: a released or unreleased track, a sketch from your archive, or a short clip. Metadata is not important; Resomix listens to your reference audio and extracts its sonic DNA to find a perfect match
          </div>
        </div>
        <div className='flex flex-col justify-between mb-[var(--px-16)] items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img className="w-[var(--px-58)] h-[var(--px-60)] mr-[var(--px-12)] mb-[var(--px-4)]" aria-hidden="true" loading="lazy" draggable={false} src={AnalysisSvg} alt="Analysis" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              2 — Deep Sound<br />Analysis
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            PYXIS-1 performs a full spectral analysis on a granular level, exploring every aspect of your tune rhythm, harmonic content, energy flow, dynamics, and tonal balance
          </div>
        </div>
        <div className='flex flex-col justify-between mb-[var(--px-16)] items-start'>
          <div className='flex items-center justify-start mb-[var(--px-16)]'>
            <img className="w-[var(--px-52)] h-[var(--px-52)] mr-[var(--px-12)] mb-[var(--px-4)]" aria-hidden="true" loading="lazy" draggable={false} src={MatchesSvg} alt="Matches" />
            <div className='text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-24)]'>
              3 — Get Perfect<br />Matches
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger leading-[var(--px-16)] tracking-[var(--px-0-15)]'>
            Within seconds, PYXIS-1 returns a ranked list of tracks scored by sonic similarity - with waveform preview, one-click feedback, and the ability to chain-discover from any result
          </div>
        </div>
        <div className="mt-[var(--px-90)]">
          <div className="w-full flex justify-center items-center">
            <ButtonHeavyRight text="Get your first match free" onClick={() => {
              window.location.href = BASE_BETA_URL
            }} link_arrow={true} className="cta-button primary" id="home-four-get-match-button" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeFour;
