import React from "react";
import ArrowDownLeftSvg from "@/assets/icons/arrow_big_down_left_stroke.svg";
import SoundWavesSvg from "@/assets/icons/sound_waves_outline.svg";
import { ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const HomeThree: React.FC = () => (
  <div className='mt-[var(--px-90)] flex flex-col w-full relative z-15'>
    <div className="mb-[var(--px-90)]">
      <div className="w-full flex justify-center items-center">
        <ButtonHeavyRight text="Start Your Sonic Journey" onClick={() => {
          window.location.href = BASE_BETA_URL
        }} link_arrow={true} className="cta-button primary" id="home-three-start-journey-button" />
      </div>
    </div>
    <div className='flex flex-col w-full'>
      <div className="flex flex-col">
        <div className="flex flex-col">
          <div className="flex items-start justify-between">
            <div className="text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-20)] uppercase tracking-wide text-left">
              Resomix brings<br />the art of selection
            </div>
            <div className="flex items-center justify-center">
              <img src={ArrowDownLeftSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Arrow Down" className="w-[var(--px-36)] h-[var(--px-36)]" />
            </div>
          </div>
          <div className="text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-20)] uppercase tracking-wide text-left">
            into the age of deep learning
          </div>
        </div>
        <div className="text-[length:var(--px-14)] text-left font-extralight font-auger mt-[var(--px-28)] leading-[var(--px-16)]">
          The thrill and excitement of crate<br />digging, but with the power, speed, and<br />convenience of cutting-edge technology.
        </div>
        <div className="text-[length:var(--px-14)] text-left font-extralight font-auger mt-[var(--px-14)] leading-[var(--px-16)]">
          Our unique approach amplifies personal<br />taste, and shines a light on hidden gems<br />at the edges of catalogs, archives, and<br />time.
        </div>
      </div>
    </div>
    <div className='mt-[var(--px-180)] flex flex-col justify-between w-full'>
      <div className="justify-start text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-22)]">A safe haven for DJs escaping<br />the noise of algorithms and<br />trends</div>
      <div className="flex items-center justify-center my-[var(--px-40)]">
        <img src={SoundWavesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Sound Waves" className="w-[var(--px-160)] h-[var(--px-131)]" />
      </div>
      <div className="text-right justify-start text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-22)]">Resomix will expand your sonic<br />horizon, discovering threads you<br />never knew were there.</div>
    </div>
  </div>
);

export default HomeThree;
