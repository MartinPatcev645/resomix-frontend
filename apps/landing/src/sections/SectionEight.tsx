import React from "react";
import SectionEightGraphicRightSvg from "../assets/icons/composites/section_eight_graphic_right.svg";
import SectionEightGraphicLeftSvg from "../assets/icons/composites/section_eight_graphic_left.svg";
import DividerSvg from "../assets/icons/divider.svg";

const SectionEight: React.FC = () => (
  <div className="mt-[200px] px-[65px] relative z-15 flex flex-col justify-between">
    <div className="flex justify-end w-full relative">
      {/* Right graphic here */}
      <div className="absolute top-1/3 right-0 transform text-[13px] font-light font-auger text-right z-20 mr-15 -mt-1 leading-4 opacity-50">
        The DJ's Secret Weapon<br />for Instant Inspiration
      </div>
      <img src={SectionEightGraphicRightSvg} alt="Section Eight Graphic Right" />
    </div>
    <div className="flex flex-col justify-center items-center w-full mt-10">
      <div className="flex flex-col uppercase text-[25px] font-extralight leading-7 mt-6 opacity-90 font-helvetica items-center">
        <div className="">
          Let us do the heavy lifting, while you focus on
        </div>
        <div className="flex items-center gap-3">
          <div className="">
            creating something
          </div>
          <div className="">
            <img src={DividerSvg} alt="Divider" />
          </div>
          <div className="">
            unforgettable.
          </div>
        </div>
      </div>
      <div className="text-[13px] font-extralight font-auger opacity-50 mt-6 text-center leading-4">
        Discovery Through Sound.<br />Connection Through Emotion.
      </div>
    </div>
    <div className="flex justify-start w-full relative">
      {/* Left graphic here */}
      <div className="absolute top-1/3 left-0 text-left text-[13px] font-auger font-light z-20 ml-8 -mt-1 leading-4 opacity-50">
        Resomix is designed<br />to save you time and<br />expand your music taste.
      </div>
      <img src={SectionEightGraphicLeftSvg} alt="Section Eight Graphic Left" />
    </div>
  </div>
);

export default SectionEight;
