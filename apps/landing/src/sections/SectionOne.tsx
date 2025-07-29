import React from "react";
import SectionOneGraphicRight from "../assets/icons/composites/section_one_graphic_right.svg"
import SectionOneGraphicLeft from "../assets/icons/composites/section_one_graphic_left.svg"

const SectionOne: React.FC = () => (
  <div className='my-[var(--px-160)] px-[var(--px-65)]'>
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex justify-between items-end'>
        <div className="justify-end text-[length:var(--px-33)] font-extralight font-helvetica uppercase leading-[var(--px-36)]">Resomix is the first sonic<br />analysis platform<br />of its kind</div>
        <div className='flex items-end mb-[var(--px-32)] relative'>
          <div className="absolute top-1/3 right-0 transform text-[length:var(--px-13)] font-light font-auger text-right z-20 mr-[var(--px-60)] -mt-[var(--px-16)] leading-[var(--px-16)] opacity-50">
            Designed to delve<br />into the essence of<br />reference tracks
          </div>
          <img className="w-[var(--px-700)] h-[var(--px-154)]" src={SectionOneGraphicRight} alt="Section One Graphic Right" />
        </div>
      </div>
      <div className='flex justify-between mt-[var(--px-64)]'>
        <div className="relative">
          <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-13)] font-auger font-light z-20 ml-[var(--px-32)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-50">
            Built by DJs,<br />for DJs
          </div>
          <img className="w-[var(--px-605)] h-[var(--px-114)]" src={SectionOneGraphicLeft} alt="Section One Graphic Left" />
        </div>
        <div className="text-right justify-start text-white text-[length:var(--px-33)] font-extralight font-helvetica uppercase leading-[var(--px-36)]">bringing back results that<br />match its mood and spirit<br />in fresh, surprising ways</div>
      </div>
    </div>
  </div>
);

export default SectionOne;
