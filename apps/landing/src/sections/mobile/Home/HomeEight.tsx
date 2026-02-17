import React from "react";
import SectionEightGraphicRightSvg from "@/assets/icons/composites/section_eight_graphic_right.svg";
import SectionEightGraphicLeftSvg from "@/assets/icons/composites/section_eight_graphic_left.svg";
import DividerSvg from "@/assets/icons/divider.svg";

const HomeEight: React.FC = () => (
  <div className="relative z-15 flex flex-col justify-between">
    <div className="flex justify-end w-full relative">
      {/* Right graphic here */}
      <div className="absolute top-1/3 right-0 transform text-[length:var(--px-14)] font-extralight font-auger text-right z-20 mr-[var(--px-32)] -mt-[var(--px-4)] leading-[var(--px-16)] tracking-[var(--px-0-1)]">
        The DJ's Secret Weapon<br />for Instant Inspiration
      </div>
      <img src={SectionEightGraphicRightSvg} aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-280)] h-[var(--px-80)]" alt="Section Eight Graphic Right" />
    </div>
    <div className="flex flex-col justify-center items-center w-full mt-[var(--px-60)]">
      <div className="flex flex-col uppercase text-[length:var(--px-20)] font-light leading-[var(--px-20)] mt-[var(--px-30)] font-helvetica items-center text-center">
        <div className="">
          Let us do the heavy lifting,<br />while you focus on creating
        </div>
        <div className="flex items-center gap-[var(--px-5)]">
          <div className="">
            something
          </div>
          <div className="">
            <img src={DividerSvg} aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-24)] h-[var(--px-24)]" alt="Divider" />
          </div>
          <div className="">
            unforgettable.
          </div>
        </div>
      </div>
      <div className="text-[length:var(--px-14)] font-extralight font-auger mt-[var(--px-10)] text-center leading-[var(--px-14)]">
        Discovery Through Sound.<br />Connection Through Emotion.
      </div>
    </div>
    <div className="flex justify-start w-full relative mt-[var(--px-80)]">
      {/* Left graphic here */}
      <div className="absolute top-1/3 left-0 text-left text-[length:var(--px-14)] font-auger font-light z-20 -mt-[var(--px-4)] leading-[var(--px-16)] ml-[var(--px-35)] tracking-[var(--px-0-1)]">
        Resomix is designed<br />to save you time and<br />expand your music taste.
      </div>
      <img src={SectionEightGraphicLeftSvg} aria-hidden="true" loading="lazy" draggable={false} className="w-[var(--px-290)] h-[var(--px-110)]" alt="Section Eight Graphic Left" />
    </div>
  </div>
);

export default HomeEight;
