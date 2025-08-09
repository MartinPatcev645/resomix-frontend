import React, { useRef } from "react";
import { CodeTyping } from "@resomix/ui";
// import { Remains } from "@resomix/ui";
import AngleDown from "@/assets/icons/AngleDown.svg";
import ArrowSmallDown from "@/assets/icons/arrow_small_down.svg";
import LineThree from "@/assets/icons/line3.svg";


const UploadHero: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  // const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");

  return (
    <div ref={sectionRef} className="relative">
      {/* Hidden SVG defs for clip-path */}
      <svg
        viewBox="0 0 1152 628"
        preserveAspectRatio="none"
        className="absolute inset-0 w-[length:var(--px-1152)] h-[length:var(--px-628)] pointer-events-none z-10"
      >
        <defs>
          <clipPath id="heroClip" clipPathUnits="objectBoundingBox">
            <path transform="scale(0.0008680556,0.0015923567)" d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z" />
          </clipPath>
        </defs>

        {/* stroke outline */}
        <path
          d="M279.222 1.07413H0.333008L0.333336 628H279.222L347.74 585.889H779.963L848.481 628H1152L1152 1.07413H848.481L779.963 40.6333H347.74L279.222 1.07413Z"
          stroke="white"
          strokeOpacity="1"
          strokeWidth="1"
          strokeDasharray="0.74 0.74"
          fill="none"
        />
      </svg>

      {/* Clip content inside shape */}
      <div
        className="relative w-[var(--px-1152)] h-[var(--px-628)] mx-auto z-20"
        style={{
          clipPath: "url(#heroClip)",
          WebkitClipPath: "url(#heroClip)"
        }}
      >
        {/* Background noise layers (two, for consistency with other sections) */}
        {/* <BackgroundNoise zIndex={1} opacity={0.8} /> */}

        {/* Remains background animation */}
        {/* <div className="absolute inset-0 w-[var(--px-1152)] h-[var(--px-627-5)]">
        {isVisible && <Remains />}
      </div> */}

        {/* Overlay content */}
        <div className="absolute inset-0 flex flex-col justify-center w-full h-full select-none py-auto">
          <div className="text-[length:var(--px-8)] mb-[var(--px-30)] font-normal font-fira font-extralight tracking-[var(--px-1-5)] w-full text-center relative z-15 min-h-[var(--px-42)]">
            <CodeTyping
              speed={50}
              text='// RESOMIX SYSTEM v1.0.9'
              multiline={true}
            />
            <CodeTyping
              speed={10}
              delay={1000}
              text='[booting...]'
            />
            <CodeTyping
              className="mt-[var(--px-8)]"
              speed={100}
              delay={2500}
              text='init.protocol("resonance_scan")'
              multiline={true}
            />
          </div>
          <div className="flex justify-start items-start w-full relative z-15">
            <div className="text-[length:var(--px-62)] font-semibold font-helvetica uppercase">Here's Where</div>
            <div className="text-[length:var(--px-8)] font-normal font-fira font-extralight tracking-[var(--px-1-5)] ml-[var(--px-20)] mt-[var(--px-20)]">
              <CodeTyping
                speed={100}
                text='>> analyzing_reference_track...'
                delay={3000}
              />
              <CodeTyping
                speed={100}
                text='>> extracting sonic signature...'
                delay={3500}
              />
              <CodeTyping
                speed={100}
                text='>> isolating emotional DNA...'
                delay={4000}
              />
            </div>
          </div>
          <div className='flex w-full justify-between items-center -mt-[var(--px-40)] relative z-15'>
            <div className='flex gap-[var(--px-12)]'>
              <img className="w-[var(--px-35)] h-[var(--px-35)]" src={ArrowSmallDown} alt="Arrow Small Down" />
              <div className="justify-start text-[length:var(--px-17)] font-normal font-helvetica uppercase leading-[var(--px-20)] text-white">Upload a reference track,<br />and unlock a universe of sounds.</div>
            </div>
            <div className="text-[length:var(--px-62)] font-semibold font-helvetica uppercase text-right">The Journey <span className="italic">Begins</span></div>
          </div>
          <div className="flex justify-center items-center w-full relative z-15">
            <img src={LineThree} className="w-[var(--px-4)] h-[var(--px-60)]" alt="Line Three" />
          </div>
          <div className="text-[length:var(--px-8)] mb-[var(--px-30)] font-normal font-fira font-extralight tracking-[var(--px-1-5)] w-full text-center relative z-15 min-h-[var(--px-30)]">
            <CodeTyping
              speed={50}
              text='> gateway.open()<br /> auth_granted: DJ_MODE_ACTIVE<br /> session_ID: RSX_8472A'
              multiline={true}
            />
          </div>
          <div className="text-[length:var(--px-8)] mb-[var(--px-30)] font-normal font-fira font-extralight tracking-[var(--px-1-5)] leading-[var(--px-16)] w-full text-center relative z-15 min-h-[var(--px-40)]">
            <CodeTyping
              speed={50}
              text='—<br />/* Beginning Sonic Transition */<br />[✓] Welcome to Resomix'
              multiline={true}
            />
          </div>
        </div>
      </div>

      {/* Text below the SVG clip path */}
      <div className='flex justify-center items-center gap-[var(--px-8)] -mt-[var(--px-30)] relative z-15'>
        <img src={AngleDown} className="w-[var(--px-55)] h-[var(--px-44)]" alt="Sound Waves" />
      </div>
    </div>
  );
};

export default UploadHero;
