import React from "react";
import ArrowDownRightSvg from "@/assets/icons/arrow_down_right.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves_2.svg";
import { ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const HomeThree: React.FC = () => (
  <div className='mt-[var(--px-170)] flex flex-col w-full relative z-15'>
    <div className="mb-[var(--px-150)]">
      <div className="w-full flex justify-center items-center">
        <ButtonHeavyRight text="Upload Your Track" onClick={() => {
          window.location.href = BASE_BETA_URL
        }} link_arrow={true} className="cta-button primary" id="home-three-start-journey-button" />
      </div>
    </div>
    <div className='flex flex-col w-full'>
      <div className='flex justify-between items-start'>
        <div className='flex gap-[var(--px-20)] justify-start items-center'>
          <img className="w-[var(--px-43)] h-[var(--px-44)]" aria-hidden="true" loading="lazy" draggable={false} src={ArrowDownRightSvg} alt="Arrow Down Right" />
          <div className="justify-start text-[length:var(--px-59)] font-light font-helvetica uppercase leading-[var(--px-64)]">RESOMIX BRINGS</div>
        </div>
        <div className="text-right justify-start text-[length:var(--px-13)] font-extralight font-auger mt-[var(--px-12)] opacity-70">The instinct of a crate digger, amplified by<br />spectral analysis. This is what discovery feels like<br />when your trusted tool understands the music</div>
      </div>
      <div className="justify-start text-[length:var(--px-59)] font-light font-helvetica uppercase leading-[var(--px-64)]">THE ART OF SELECTION<br />INTO THE AGE OF ALGORITHMIC PRECISION</div>
    </div>
    <div className='mt-[var(--px-350)] flex justify-between items-start'>
      <div className="justify-start text-[length:var(--px-25)] font-light font-montserrat uppercase leading-[var(--px-28)]">BEYOND CHARTS. BEYOND TRENDS<br />BEYOND WHAT'S POPULAR</div>
      <img src={SoundWavesSvg} alt="Sound Waves" aria-hidden="true" loading="lazy" draggable={false} className="mt-[var(--px-4)] w-[var(--px-59)] h-[var(--px-48)]" />
      <div className="text-right justify-start text-[length:var(--px-25)] font-light font-montserrat uppercase leading-[var(--px-28)]">RESOMIX REVEALS THE SONIC THREADS<br />YOU NEVER KNEW WERE THERE</div>
    </div>
  </div>
);

export default HomeThree;
