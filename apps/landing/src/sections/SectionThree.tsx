import React from "react";
import ArrowDownRightSvg from "../assets/icons/arrow_down_right.svg";
import SoundWavesSvg from "../assets/icons/sound_waves_2.svg";

const SectionThree: React.FC = () => (
  <div className='mt-[350px] flex flex-col w-full px-[45px] relative z-15'>
    <div className='flex flex-col w-full'>
      <div className='flex justify-between items-start'>
        <div className='flex gap-5 justify-start items-center'>
          <img src={ArrowDownRightSvg} alt="Arrow Down Right" />
          <div className="justify-start text-[59px] font-light font-helvetica uppercase">RESOMIX BRINGS</div>
        </div>
        <div className="text-right justify-start text-[13px] font-extralight font-auger mt-3 opacity-50">The thrill and excitement of crate digging, but with the power,<br />speed, and convenience of cutting-edge technology.</div>
      </div>
      <div className="justify-start text-[59px] font-light font-helvetica uppercas leading-18">THE ART OF SELECTION<br />INTO THE AGE OF DEEP LEARNING</div>
    </div>
    <div className='mt-[350px] flex justify-between items-start'>
      <div className="justify-start text-[25px] font-light font-montserrat uppercase leading-7">A safe haven for DJs escaping the<br />noise of algorithms and trends</div>
      <img src={SoundWavesSvg} alt="Sound Waves" className="mt-1" />
      <div className="text-right justify-start text-[25px] font-light font-montserrat uppercase leading-7">Resomix will expand your sonic<br />horizon, discover threads you never<br />knew were there.</div>
    </div>
  </div>
);

export default SectionThree;
