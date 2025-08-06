import React from "react";
import SectionOneGraphicRight from "../../assets/icons/composites/mobile/section_one_graphic_right.svg"
import SectionOneGraphicLeft from "../../assets/icons/composites/mobile/section_one_graphic_left.svg"

const SectionOne: React.FC = () => (
  <div className='mt-[var(--px-200)]'>
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex flex-col justify-between items-end w-full'>
        <div className='flex items-end mb-[var(--px-32)] relative'>
          <div className="absolute top-1/3 right-0 transform text-[length:var(--px-9)] font-extralight font-auger text-right z-20 mr-[var(--px-30)] -mt-[var(--px-8)] leading-[var(--px-10)]">
            Designed to delve<br />into the essence of<br />reference tracks
          </div>
          <img className="w-[var(--px-334)] h-[var(--px-90)]" src={SectionOneGraphicRight} alt="Section One Graphic Right" />
        </div>
        <div className="items-start w-full text-[length:var(--px-18)] font-extralight font-helvetica uppercase leading-[var(--px-20)] tracking-wider">Resomix is the first sonic analysis<br />platform of its kind</div>
      </div>
      <div className='flex flex-col justify-between mt-[var(--px-48)] w-full'>
        <div className="relative">
          <div className="absolute top-1/3 left-0 transform text-[length:var(--px-9)] font-extralight font-auger text-left z-20 ml-[var(--px-20)] -mt-[var(--px-4)] leading-[var(--px-10)]">
            Built by DJs,<br />for DJs &gt;&gt;&gt;
          </div>
          <img className="w-[var(--px-310)] h-[var(--px-94)]" src={SectionOneGraphicLeft} alt="Section One Graphic Left" />
        </div>
        <div className="text-right w-full text-[length:var(--px-18)] font-extralight font-helvetica uppercase leading-[var(--px-20)] tracking-wider mt-[var(--px-30)]">bringing back results that<br />match its mood and spirit<br />in fresh, surprising ways</div>
      </div>
    </div>
  </div>
);

export default SectionOne;
