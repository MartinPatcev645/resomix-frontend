import React from "react";
import ArrowDownLeftSvg from "../../assets/icons/arrow_big_down_left_stroke.svg";
import SoundWavesSvg from "../../assets/icons/sound_waves_outline.svg";

const SectionThree: React.FC = () => (
  <div className='mt-[var(--px-200)] flex flex-col w-full relative z-15'>
    <div className='flex flex-col w-full'>
      <div className="flex flex-col">
        <div className="flex flex-col">
          <div className="flex items-start justify-between">
            <div className="text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-20)] uppercase tracking-wide text-left">
              Resomix brings<br />the art of selection
            </div>
            <div className="flex items-center justify-center">
              <img src={ArrowDownLeftSvg} alt="Arrow Down" className="w-[var(--px-36)] h-[var(--px-36)]" />
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
        <img src={SoundWavesSvg} alt="Sound Waves" className="w-[var(--px-160)] h-[var(--px-131)]" />
      </div>
      <div className="text-right justify-start text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-22)]">Resomix will expand your sonic<br />horizon, discover threads you<br />never knew were there.</div>
    </div>
  </div>
);

export default SectionThree;
