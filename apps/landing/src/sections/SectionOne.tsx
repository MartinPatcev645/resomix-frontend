import React from "react";
import SectionOneGraphicRight from "../assets/icons/composites/section_one_graphic_right.svg"
import SectionOneGraphicLeft from "../assets/icons/composites/section_one_graphic_left.svg"

const SectionOne: React.FC = () => (
  <div className='my-40 px-[45px]'>
    <div className='flex flex-col w-full'>
      <div className='flex justify-between items-start'>
        <div className="justify-end text-[33px] font-extralight font-['Helvetica_Neue'] uppercase">Resomix is the first sonic<br />analysis platform<br />of its kind</div>
        <div className='flex items-end'>
          <img src={SectionOneGraphicRight} alt="Section One Graphic Right" />
        </div>
      </div>
      <div className='flex justify-between'>
        <img src={SectionOneGraphicLeft} alt="Section One Graphic Left" />
        <div className="text-right justify-start text-white text-[33px] font-extralight font-['Helvetica_Neue'] uppercase">bringing back results that<br />match its mood and spirit<br />in fresh, surprising ways</div>
      </div>
    </div>
  </div>
);

export default SectionOne;
