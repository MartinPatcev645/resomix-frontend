import React from "react";
import SectionFiveGraphicLeft from "../assets/icons/composites/section_five_graphic_left.svg";
import SectionFiveGraphicRight from "../assets/icons/composites/section_five_graphic_right.svg";
import ArrowBigDownSvg from "../assets/icons/arrow_big_down_stroke.svg";

const SectionFive: React.FC = () => (
  <div className='mt-[250px] px-[65px] flex flex-col relative z-15'>
    {/* Section Five A */}
    <div className='flex flex-col w-full my-20'>
      <div className='flex w-full justify-end relative'>
        <div className="absolute top-1/3 right-0 transform text-[13px] font-light font-auger text-right z-20 mr-15 -mt-1 leading-4 opacity-50">
          Deep sonic analysis, pure and simple,<br />unaffected by metadata or trends.
        </div>
        <img src={SectionFiveGraphicRight} alt="Section Five Graphic Right" />
      </div>
      <div className='flex flex-col w-full justify-center'>
        <div className="mx-auto text-center text-[25px] font-extralight leading-7 mt-6 opacity-90 font-helvetica uppercase">
          Resomix is the only platform in the world that<br />focuses on the “soul” of your reference track to<br />find music that matches its mood and spirit.
        </div>
        <div className='mx-auto text-center text-[13px] font-extralight mt-3 opacity-60 font-auger'>
          Cutting-Edge Innovation
        </div>
      </div>
      <div className='flex w-full justify-start relative'>
        <div className="absolute top-1/3 left-0 text-left text-[13px] font-auger font-light z-20 ml-8 -mt-1 leading-4 opacity-50">
          A human approach<br />to modern technology
        </div>
        <img src={SectionFiveGraphicLeft} alt="Section Five Graphic Left" />
      </div>
    </div>

    {/* Section Five B */}
    <div className='mt-[300px] flex flex-row w-full my-20 justify-between items-center'>
      <div className='flex flex-col text-[66px] font-bold leading-16 font-helvetica uppercase'>
        <div className=''>
          INSTANT
        </div>
        <div className='flex items-center'>
          <img src={ArrowBigDownSvg} alt="Arrow Big Down" />
          <div className=''>
            CATALOG
          </div>
        </div>
        <div className=''>
          SEARCH
        </div>
      </div>
      <div className='flex flex-col'>
        <div className='text-[length:var(--px-22)] font-fira font-semibold uppercase leading-7 text-right'>
          Explore a vast catalog in seconds and discover<br />sonic connections where no one else sees them
        </div>
        <div className='text-[13px] font-extralight font-auger text-right opacity-60 leading-4 my-3'>
          Whether you're looking for underground gems or timeless hits,<br />
          Resomix can help you create unforgettable sets<br />
          that resonate with people.
        </div>
        <div className='flex items-center justify-end mt-4'>
          <div className="11 relative bg-[var(--color-primary)] rounded-3xl outline outline-[0.50px] outline-offset-[-0.50px] outline-[var(--color-primary)] overflow-hidden p-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="4 2 16 16" fill="none">
              <path d="M17.8983 11.1113H5.30566" stroke="black" stroke-width="0.592593" stroke-linecap="square" />
              <path d="M13.4541 15.5558C13.4541 13.271 15.4663 11.1113 17.8985 11.1113" stroke="black" stroke-width="0.592593" stroke-linecap="square" />
              <path d="M13.4541 6.6665C13.4541 8.95133 15.4663 11.1109 17.8985 11.1109" stroke="black" stroke-width="0.592593" stroke-linecap="square" />
            </svg>
          </div>
          <input type="text" placeholder='Search Now' className="w-[588px] h-[34px] py-[8.889px] px-[19.259px] bg-[var(--color-primary)] rounded-[30px] outline outline-[0.50px] outline-offset-[-0.50px] outline-[var(--color-primary)] text-[var(--color-text-primary)] text-[11px] font-fira inline-flex justify-center items-center gap-2.5" />
        </div>
        <div className=''>
          {/* This will have the dropdown when user searches and we get search results */}
        </div>
      </div>
    </div>
  </div>
);

export default SectionFive;
