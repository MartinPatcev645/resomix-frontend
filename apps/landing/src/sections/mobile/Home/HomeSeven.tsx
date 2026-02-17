import React, { useRef } from "react";
import ArrowBigDownSvg from "@/assets/icons/ArrowBigDown2.svg";
import { ButtonHeavyRight } from "@resomix/ui";

const HomeSeven: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  return (
    <div ref={sectionRef} className='mt-[var(--px-200)] relative'>
      {/* Rock ring animation */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: 'var(--px-489)',
          top: 'var(--px-448)',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: -1,
          pointerEvents: 'none',
          opacity: '60%'
        }}
      >
      </div>
      {/* Content with higher z-index */}
      <div className='flex flex-col w-full relative z-15'>
        <div className='flex flex-col justify-start items-start w-full'>
          <div className='flex flex-col items-start w-full'>
            <div className='flex items-center justify-start gap-[var(--px-12)]'>
              <img src={ArrowBigDownSvg} draggable={false} aria-hidden="true" loading="lazy" alt="Arrow Big Down" className="w-[var(--px-26)] h-[var(--px-26)]" />
              <div className='text-[length:var(--px-43)] font-helvetica uppercase font-bold leading-[var(--px-50)]'>
                DROP
              </div>
            </div>
            <div className='text-[length:var(--px-43)] font-helvetica uppercase font-bold leading-[var(--px-50)]'>
              A TRACK AND<br />EXPLORE NEW<br />POSSIBILITIES
            </div>
          </div>
          <div className='text-[length:var(--px-14)] font-extralight font-auger text-left mt-[var(--px-14)] leading-[var(--px-14)]'>
            Simplicity and minimalism. Just upload<br />a sound, and Resomix will listen.
          </div>
        </div>
        <div className="w-full flex justify-center items-center pb-[var(--px-100)] min-h-[var(--px-309)]">
          <ButtonHeavyRight className="w-[var(--px-280)] cta-button primary" text="Unlock a Universe of Sounds" onClick={() => { }} link_arrow={true} id="home-seven-unlock-button" />
        </div>
      </div>
    </div>
  );
};

export default HomeSeven;
