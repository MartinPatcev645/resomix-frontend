import React, { useRef } from "react";
import ArrowBigDownSvg from "@/assets/icons/ArrowBigDown2.svg";
import { ButtonHeavyRight } from "@resomix/ui";
import { useOnScreen } from "@resomix/hooks";
import { BASE_BETA_URL } from "@resomix/config";

const HomeSeven: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "1000px 0px 1000px 0px");

  return (
  <div ref={sectionRef} className='mt-[var(--px-200)] relative'>
    {/* Rock ring animation */}
    {isVisible && (
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
    )}
    {/* Content with higher z-index */}
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex flex-col justify-start items-start w-full'>
        <div className='flex items-start justify-between w-full'>
          <div className='flex items-center justify-start gap-[var(--px-24)]'>
            <img src={ArrowBigDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Arrow Big Down" className="w-[var(--px-43)] h-[var(--px-44)]" />
            <div className='text-[length:var(--px-59)] font-helvetica uppercase font-light leading-[var(--px-64)]'>
              DROP A TRACK
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger opacity-70 text-right'>
            Simplicity and minimalism.<br />Just upload a sound, and Resomix will listen.
          </div>
        </div>
        <div className='text-[length:var(--px-59)] font-helvetica uppercase font-light leading-[var(--px-64)]'>
          AND EXPLORE NEW POSSIBILITIES
        </div>
      </div>
      <div className="w-full flex justify-center items-center pt-[var(--px-60)] pb-[var(--px-100)] min-h-[var(--px-309)]">
        <ButtonHeavyRight text="Unlock a Universe of Sounds" onClick={() => {
          window.location.href = BASE_BETA_URL
        }} link_arrow={true} className="cta-button primary" id="home-seven-unlock-button" />
      </div>
    </div>
  </div>
  );
};

export default HomeSeven;
