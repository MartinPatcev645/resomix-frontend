import React from "react";
import GridTunnelSvg from "../assets/icons/grid tunnel.svg";
import AngleDownSvg from "../assets/icons/AngleDown.svg";

const SectionSix: React.FC = () => (
  <div className='mt-[250px] px-[45px]'>
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
      <div className='absolute inset-0 flex flex-col justify-between my-[245px] mx-[100px] items-center text-center z-10'>
        <div className='flex w-full justify-end mr-20 text-[13px] font-extralight text-right font-auger opacity-50'>
          To all DJs lost in the vastness of the modern sound universe:<br />
          let Resomix be the gravitational force that draws you<br />
          to the tracks you need.
        </div>
        <div className='flex w-full justify-center text-center text-[25px] font-extralight font-helvetica uppercase leading-7'>
          RESOMIX revolutionized music<br />
          discovery by putting sound first
        </div>
        <div className='flex w-full justify-start ml-20 text-[13px] font-extralight text-left font-auger opacity-50'>
          Cutting-edge Machine Learning to Enhance<br />
          Human Imagination, Proprietary models designed<br />
          to listen like producers, and discover like DJs.
        </div>
      </div>
    </div>
    <div className="flex w-full justify-center -mt-[110px]">
      <img src={AngleDownSvg} alt="Angle Down" className="" />
    </div>
  </div>
);

export default SectionSix;
