import React from "react";
import SectionEightGraphicRightSvg from "@/assets/icons/composites/section_eight_graphic_right.svg";
import SectionEightGraphicLeftSvg from "@/assets/icons/composites/section_eight_graphic_left.svg";
import DividerSvg from "@/assets/icons/divider.svg";

const HomeEight: React.FC = () => (
  <div className="mt-[var(--px-200)] relative z-15 flex flex-col justify-between">
    <div className="flex justify-end w-full relative">
      {/* Right graphic here */}
      <div className="absolute top-1/3 right-0 transform text-[length:var(--px-13)] font-light font-auger text-right z-20 mr-[var(--px-60)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-70">
        The DJ's Secret Weapon<br />for Instant Inspiration
      </div>
      <img src={SectionEightGraphicRightSvg} draggable={false} className="w-[var(--px-324)] h-[var(--px-93)]" alt="Section Eight Graphic Right" />
    </div>
    <div className="flex flex-col justify-center items-center w-full mt-[var(--px-40)]">
      <div className="flex flex-col uppercase text-[length:var(--px-25)] font-extralight leading-[var(--px-28)] mt-[var(--px-24)] opacity-90 font-helvetica items-center">
        <div className="">
          Let us do the heavy lifting, while you focus on
        </div>
        <div className="flex items-center gap-[var(--px-12)]">
          <div className="">
            creating something
          </div>
          <div className="">
            <img src={DividerSvg} draggable={false} className="w-[var(--px-19)] h-[var(--px-20)]" alt="Divider" />
          </div>
          <div className="">
            unforgettable.
          </div>
        </div>
      </div>
      <div className="text-[length:var(--px-13)] font-extralight font-auger opacity-70 mt-[var(--px-24)] text-center leading-[var(--px-16)]">
        Discovery Through Sound.<br />Connection Through Emotion.
      </div>
    </div>
    <div className="flex justify-start w-full relative">
      {/* Left graphic here */}
      <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-13)] font-auger font-light z-20 ml-[var(--px-32)] -mt-[var(--px-4)] leading-[var(--px-16)] opacity-70">
        Resomix is designed<br />to save you time and<br />expand your music taste.
      </div>
      <img src={SectionEightGraphicLeftSvg} draggable={false} className="w-[var(--px-276)] h-[var(--px-108)]" alt="Section Eight Graphic Left" />
    </div>
  </div>
);

export default HomeEight;
