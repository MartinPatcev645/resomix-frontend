import React from "react";
import LayersSvg from "@/assets/icons/layers.svg";
import VerticalLineSvg from "@/assets/icons/vertical_line.svg";
import { ContourSphere, CodeTyping } from "@resomix/ui";

const HomeTwo: React.FC = () => (
  <div className='mt-[var(--px-450)] relative'>
    {/* Contour Sphere Animation */}
    <div
      style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    >
      <ContourSphere 
        localScroll 
        size={550} 
        scrollAreaHeight="clamp(var(--px-800), 200vh, var(--px-2560))" 
        start="top bottom" 
        end="bottom top" 
      />
    </div>
    {/* Content with higher z-index */}
    <div className='flex flex-col justify-between items-center relative z-15'>
      <div className=''></div>
      <div className='flex flex-col justify-center items-center'>
        <div className=''>
          <img src={LayersSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Layers" className="w-[var(--px-38)] h-[var(--px-41)]" />
        </div>
        <div className="text-center justify-start text-[length:var(--px-13)] font-extrabold font-auger mt-[var(--px-24)] leading-[var(--px-16)] opacity-90">
          Precision Over Volume
        </div>
        <div className="text-center justify-start text-[length:var(--px-13)] font-extralight font-auger mt-[var(--px-24)] leading-[var(--px-16)] opacity-70">Every result earned through 70+ dimensions of spectral analysis.<br />Not surfaced by popularity. Not boosted by marketing spend.<br />Fewer results. Higher relevance.</div>
      </div>
      <div className='my-[var(--px-32)]'>
        <img src={VerticalLineSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Vertical Line" className="w-[var(--px-2)] h-[var(--px-63)]" />
      </div>
      <div className="opacity-80 justify-start text-[var(--color-primary)] text-[length:var(--px-7)] font-light font-fira tracking-widest min-h-[var(--px-10-5)]">
        <CodeTyping
          speed={50}
          text="instant_inspiration.module[active]"
        />
      </div>
    </div>
  </div>
);

export default HomeTwo;
