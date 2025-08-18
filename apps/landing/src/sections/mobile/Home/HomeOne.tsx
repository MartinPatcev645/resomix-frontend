import React from "react";
import SectionOneGraphicRight from "@/assets/icons/composites/mobile/section_one_graphic_right.svg"
import SectionOneGraphicLeft from "@/assets/icons/composites/mobile/section_one_graphic_left.svg"

const HomeOne: React.FC = () => (
  <div className='-mt-[var(--px-80)]'>
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex flex-col justify-between items-end w-full'>
        <div className='flex items-end mb-[var(--px-32)] relative'>
          <div className="absolute top-1/3 right-0 transform text-[length:var(--px-12)] font-extralight font-auger text-right z-20 mr-[var(--px-30)] -mt-[var(--px-14)] leading-[var(--px-14)]">
            Designed to delve<br />into the essence of<br />reference tracks
          </div>
          <img className="w-[var(--px-360)] h-[var(--px-100)]" src={SectionOneGraphicRight} alt="Section One Graphic Right" />
        </div>
        <div className="items-start w-full text-[length:var(--px-20)] font-light font-helvetica uppercase leading-[var(--px-20)] tracking-wider">Resomix is the first sound<br />analysis platform of its kind</div>
      </div>
      <div className='flex flex-col justify-between mt-[var(--px-48)] w-full'>
        <div className="relative">
          <div className="absolute top-1/3 left-0 transform text-[length:var(--px-12)] font-extralight font-auger text-left z-20 ml-[var(--px-20)] -mt-[var(--px-4)] leading-[var(--px-14)]">
            Built by DJs,<br />for DJs &gt;&gt;&gt;
          </div>
          <img className="w-[var(--px-330)] h-[var(--px-100)]" src={SectionOneGraphicLeft} alt="Section One Graphic Left" />
        </div>
        <div className="text-right w-full text-[length:var(--px-18)] font-light font-helvetica uppercase leading-[var(--px-20)] tracking-wider mt-[var(--px-30)]">It brings back results that match the mood and spirit of music in fresh, surprising ways.</div>
      </div>
    </div>
  </div>
);

export default HomeOne;
