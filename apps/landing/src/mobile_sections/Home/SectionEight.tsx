import React from "react";
import SectionEightGraphicRightSvg from "../../assets/icons/composites/section_eight_graphic_right.svg";
import SectionEightGraphicLeftSvg from "../../assets/icons/composites/section_eight_graphic_left.svg";
import DividerSvg from "../../assets/icons/divider.svg";

const SectionEight: React.FC = () => (
  <div className="mt-[var(--px-200)] relative z-15 flex flex-col justify-between">
    <div className="flex justify-end w-full relative">
      {/* Right graphic here */}
      <div className="absolute top-1/3 right-0 transform text-[length:var(--px-12)] font-extralight font-auger text-right z-20 mr-[var(--px-20)] -mt-[var(--px-2)] leading-[var(--px-12)]">
        The DJ's Secret Weapon<br />for Instant Inspiration
      </div>
      <img src={SectionEightGraphicRightSvg} className="w-[var(--px-232)] h-[var(--px-66)]" alt="Section Eight Graphic Right" />
    </div>
    <div className="flex flex-col justify-center items-center w-full mt-[var(--px-60)]">
      <div className="flex flex-col uppercase text-[length:var(--px-18)] font-light leading-[var(--px-18)] mt-[var(--px-24)] font-helvetica items-center">
        <div className="">
          Let us do the heavy lifting,<br />while you focus on creating
        </div>
        <div className="flex items-center gap-[var(--px-5)]">
          <div className="">
            something
          </div>
          <div className="">
            <img src={DividerSvg} className="w-[var(--px-26)] h-[var(--px-26)]" alt="Divider" />
          </div>
          <div className="">
            unforgettable.
          </div>
        </div>
      </div>
      <div className="text-[length:var(--px-12)] font-extralight font-auger mt-[var(--px-10)] text-center leading-[var(--px-12)]">
        Discovery Through Sound.<br />Connection Through Emotion.
      </div>
    </div>
    <div className="flex justify-start w-full relative mt-[var(--px-80)]">
      {/* Left graphic here */}
      <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-12)] font-auger font-light z-20 -mt-[var(--px-4)] leading-[var(--px-12)] ml-[var(--px-20)]">
        Resomix is designed<br />to save you time and<br />expand your music taste.
      </div>
      <img src={SectionEightGraphicLeftSvg} className="w-[var(--px-251)] h-[var(--px-97)]" alt="Section Eight Graphic Left" />
    </div>
  </div>
);

export default SectionEight;
