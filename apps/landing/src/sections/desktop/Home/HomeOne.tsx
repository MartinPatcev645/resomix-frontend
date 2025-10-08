import React from "react";
import SectionOneGraphicFull from "@/assets/icons/composites/section_one_graphic_full.svg"

const HomeOne: React.FC = () => (
  <div className='my-[var(--px-160)]'>
    <div className='flex flex-col w-full relative z-15 items-center'>
      <div className="text-center text-[length:var(--px-33)] font-extralight font-helvetica uppercase leading-[var(--px-33)]">Resomix is the first sonic<br />analysis platform<br />of its kind</div>
      <div className="w-full relative mt-[var(--px-10)] mb-[var(--px-50)]">
        <img className="w-full" src={SectionOneGraphicFull} alt="Section One Graphic Full" />
        <div className="absolute top-[65%] left-0 text-left text-[length:var(--px-13)] font-auger font-light z-20 ml-[var(--px-32)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-70">
          Built by DJs,<br />for DJs
        </div>
        <div className="absolute top-[40%] right-0 transform text-[length:var(--px-13)] font-light font-auger text-right z-20 mr-[var(--px-60)] -mt-[var(--px-16)] leading-[var(--px-16)] opacity-70">
          Designed to delve<br />into the essence of<br />reference tracks
        </div>
      </div>
      <div className="text-center text-[var(--color-primary)] text-[length:var(--px-33)] font-extralight font-helvetica uppercase leading-[var(--px-33)]">Bringing back results that<br />match its mood and spirit<br />in fresh, surprising ways.</div>
    </div>
  </div>
);

export default HomeOne;
