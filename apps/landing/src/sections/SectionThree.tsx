import React from "react";
import ArrowDownRightSvg from "../assets/icons/arrow_down_right.svg";
import SoundWavesSvg from "../assets/icons/sound_waves_2.svg";

const SectionThree: React.FC = () => (
  <div className='mt-[var(--px-350)] flex flex-col w-full px-[var(--px-65)] relative z-15'>
    <div className='flex flex-col w-full'>
      <div className='flex justify-between items-start'>
        <div className='flex gap-[var(--px-20)] justify-start items-center'>
          <img className="w-[var(--px-43)] h-[var(--px-44)]" src={ArrowDownRightSvg} alt="Arrow Down Right" />
          <div className="justify-start text-[length:var(--px-59)] font-light font-helvetica uppercase leading-[var(--px-64)]">RESOMIX BRINGS</div>
        </div>
        <div className="text-right justify-start text-[length:var(--px-13)] font-extralight font-auger mt-[var(--px-12)] opacity-50">The thrill and excitement of crate digging, but with the power,<br />speed, and convenience of cutting-edge technology.</div>
      </div>
      <div className="justify-start text-[length:var(--px-59)] font-light font-helvetica uppercase leading-[var(--px-64)]">THE ART OF SELECTION<br />INTO THE AGE OF DEEP LEARNING</div>
    </div>
    <div className='mt-[var(--px-350)] flex justify-between items-start'>
      <div className="justify-start text-[length:var(--px-25)] font-light font-montserrat uppercase leading-[var(--px-28)]">A safe haven for DJs escaping the<br />noise of algorithms and trends</div>
      <img src={SoundWavesSvg} alt="Sound Waves" className="mt-[var(--px-4)] w-[var(--px-59)] h-[var(--px-48)]" />
      <div className="text-right justify-start text-[length:var(--px-25)] font-light font-montserrat uppercase leading-[var(--px-28)]">Resomix will expand your sonic<br />horizon, discover threads you never<br />knew were there.</div>
    </div>
  </div>
);

export default SectionThree;
