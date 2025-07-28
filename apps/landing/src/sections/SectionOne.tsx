import React from "react";
import SectionOneGraphicRight from "../assets/icons/composites/section_one_graphic_right.svg"
import SectionOneGraphicLeft from "../assets/icons/composites/section_one_graphic_left.svg"

const SectionOne: React.FC = () => (
  <div className='my-40 px-[65px]'>
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex justify-between items-end'>
        <div className="justify-end text-[33px] font-extralight font-helvetica uppercase leading-9">Resomix is the first sonic<br />analysis platform<br />of its kind</div>
        <div className='flex items-end mb-8 relative'>
          <div className="absolute top-1/3 right-0 transform text-[13px] font-light font-auger text-right z-20 mr-15 -mt-4 leading-4 opacity-50">
            Designed to delve<br />into the essence of<br />reference tracks
          </div>
          <img src={SectionOneGraphicRight} alt="Section One Graphic Right" />
        </div>
      </div>
      <div className='flex justify-between mt-16'>
        <div className="relative">
          <div className="absolute top-1/3 left-0 text-left text-[13px] font-auger font-light z-20 ml-8 -mt-1 leading-4 opacity-50">
            Built by DJs,<br />for DJs
          </div>
          <img src={SectionOneGraphicLeft} alt="Section One Graphic Left" />
        </div>
        <div className="text-right justify-start text-white text-[33px] font-extralight font-helvetica uppercase leading-9">bringing back results that<br />match its mood and spirit<br />in fresh, surprising ways</div>
      </div>
    </div>
  </div>
);

export default SectionOne;
