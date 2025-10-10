import React from "react";
import GridTunnelSvg from "@/assets/icons/mobile_tunnel.svg";
import AngleDownSvg from "@/assets/icons/AngleDown.svg";

const HomeSix: React.FC = () => (
  <div className='mt-[var(--px-250)] relative z-15'>
    <div className='relative w-full'>
      {/* SVG Background - stretched to full width */}
      <div className='w-full'>
        <img
          src={GridTunnelSvg}
          alt="Grid Tunnel"
          className='w-full h-auto'
        />
      </div>

      {/* Text Overlay - positioned absolutely over the SVG */}
      <div className='absolute inset-0 flex flex-col justify-between my-[var(--px-150)] items-center text-center z-10'>
        <div className='flex w-full justify-center text-[length:var(--px-14)] leading-[var(--px-16)] font-extralight font-auger'>
          To all DJs lost in the vastness of the<br />modern sound universe:
          let Resomix<br />be the gravitational force that<br />draws you
          to the tracks you need.
        </div>
        <div className='flex w-full justify-center text-[length:var(--px-20)] font-helvetica uppercase leading-[var(--px-20)]'>
          RESOMIX revolutionized music<br />
          discovery by putting<br />sound first
        </div>
        <div className='flex w-full justify-center text-[length:var(--px-14)] leading-[var(--px-16)] font-extralight font-auger'>
          Cutting-edge Machine Learning to Enhance<br />
          Human Imagination, Proprietary models<br />designed
          to listen like producers,<br />and discover like DJs.
        </div>
      </div>
    </div>
    <div className="flex w-full justify-center mt-[var(--px-40)]">
      <img src={AngleDownSvg} draggable={false} alt="Angle Down" className="w-[var(--px-67)] h-[var(--px-67)]" />
    </div>
  </div>
);

export default HomeSix;
