import React from "react";
import LayersSvg from "../assets/icons/layers.svg";
import VerticalLineSvg from "../assets/icons/vertical_line.svg";
import { ContourSphere } from "@resomix/ui";
import { CodeTyping } from "@resomix/ui";

const SectionTwo: React.FC = () => (
  <div className='mt-[var(--px-330)] relative'>
    {/* Contour Sphere Animation */}
    <div
      style={{
        position: 'absolute',
        top: '25%',
        left: '55%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    >
      <ContourSphere localScroll size={394} scrollAreaHeight={1400} />
    </div>
    {/* Content with higher z-index */}
    <div className='flex flex-col justify-between items-center relative z-15'>
      <div className=''></div>
      <div className='flex flex-col justify-center items-center'>
        <div className=''>
          <img src={LayersSvg} alt="Layers" className="w-[var(--px-38)] h-[var(--px-41)]" />
        </div>
        <div className="text-center justify-start text-[length:var(--px-12)] font-extralight font-auger mt-[var(--px-24)] leading-[var(--px-12)] opacity-70">Resomix goes deeper than anyone else,<br />carefully selecting music that reflects<br />the energy and vibe you're looking for,<br />with a quality-over-quantity approach.</div>
      </div>
      <div className='my-[var(--px-32)]'>
        <img src={VerticalLineSvg} alt="Vertical Line" className="w-[var(--px-2)] h-[var(--px-63)]" />
      </div>
      <div className="opacity-80 justify-start text-white text-[length:var(--px-7)] font-light font-fira tracking-widest min-h-[var(--px-10-5)]">
        <CodeTyping
          speed={50}
          text="instant_inspiration.module[active]"
        />
      </div>
    </div>
  </div>
);

export default SectionTwo;
