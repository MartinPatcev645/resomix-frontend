import React from "react";
import ArrowBigDownSvg from "../assets/icons/ArrowBigDown2.svg";
import SectionSevenGraphicSvg from "../assets/icons/composites/section_seven_graphic.svg";

const SextionSeven: React.FC = () => (
  <div className='mt-[200px] px-[45px] relative z-15'>
    <div className='flex flex-col w-full'>
      <div className='flex flex-col justify-start items-start w-full'>
        <div className='flex items-start justify-between w-full'>
          <div className='flex items-center justify-start gap-6'>
            <img src={ArrowBigDownSvg} alt="Arrow Big Down" />
            <div className='text-[59px] font-helvetica uppercase font-light leading-16'>
              DROP A TRACK
            </div>
          </div>
          <div className='text-[13px] font-extralight font-auger opacity-50 text-right'>
            Simplicity and minimalism.<br />Just upload a sound, and Resomix will listen.
          </div>
        </div>
        <div className='text-[59px] font-helvetica uppercase font-light leading-16'>
          AND EXPLORE NEW POSSIBILITIES
        </div>
      </div>
      <div className='flex flex-col justify-start items-start mt-[200px]'>
        <img src={SectionSevenGraphicSvg} alt="Section Seven Graphic" />
        <div className=''>
          machine_listening...
        </div>
      </div>
    </div>
  </div>
);

export default SextionSeven;
