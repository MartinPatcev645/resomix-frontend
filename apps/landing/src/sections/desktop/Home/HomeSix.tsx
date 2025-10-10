import React from "react";
import GridTunnelSvg from "@/assets/icons/grid_tunnel.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";

const HomeSix: React.FC = () => (
  <div className='mt-[var(--px-250)] relative z-15'>
    <div className='relative w-full'>
      {/* SVG Background - stretched to full width */}
      <div className='w-full opacity-80'>
        <img
          src={GridTunnelSvg}
          alt="Grid Tunnel"
          className="w-full h-auto opacity-80 mix-blend-screen"
        />
      </div>

      {/* Text Overlay - positioned absolutely over the SVG */}
      <div className='absolute inset-0 flex flex-col justify-between my-[var(--px-245)] mx-[var(--px-100)] items-center text-center z-10'>
        <div className='flex w-full justify-end mr-[var(--px-80)] text-[length:var(--px-13)] font-extralight text-right font-auger opacity-70'>
          To all DJs lost in the vastness of the modern sound universe:<br />
          let Resomix be the gravitational force that draws you<br />
          to the tracks you need.
        </div>
        <div className='flex w-full justify-center text-center text-[length:var(--px-25)] font-medium font-helvetica uppercase leading-[var(--px-28)]'>
          RESOMIX revolutionized music<br />
          discovery by putting sound first
        </div>
        <div className='flex w-full justify-start ml-[var(--px-80)] text-[length:var(--px-13)] font-extralight text-left font-auger opacity-70'>
          Cutting-edge Machine Learning to Enhance<br />
          Human Imagination, Proprietary models designed<br />
          to listen like producers, and discover like DJs.
        </div>
      </div>
    </div>
    <div className="flex w-full justify-center -mt-[var(--px-110)]">
      <img src={AngleDownSvg} draggable={false} alt="Angle Down" className="w-[var(--px-52)] h-[var(--px-53)]" />
    </div>
  </div>
);

export default HomeSix;
