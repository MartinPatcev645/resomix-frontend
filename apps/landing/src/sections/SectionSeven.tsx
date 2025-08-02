import React, { useRef } from "react";
import ArrowBigDownSvg from "../assets/icons/ArrowBigDown2.svg";
// import { ButtonHeavyRight, CodeTyping } from "@resomix/ui";
import { Terrain, ButtonHeavyRight, CodeTyping } from "@resomix/ui";
import { useOnScreen } from "@resomix/hooks";
import LineThreeSvg from "../assets/icons/line3.svg";

const SextionSeven: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "1000px 0px 1000px 0px");

  return (
  <div ref={sectionRef} className='mt-[var(--px-200)] px-[var(--px-62)] relative'>
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
      <Terrain
        speed={1.2}
        segments={324}
        perlinPasses={1}
        elevation={1}
        noiseRange={2.14}
        sombreroAmplitude={0.6}
        sombreroFrequency={10}
        wireframe={true}
        wireframeColor="#FFFFFF"
        floorVisible={false}
      />
    </div>
    )}
    {/* Content with higher z-index */}
    <div className='flex flex-col w-full relative z-15'>
      <div className='flex flex-col justify-start items-start w-full'>
        <div className='flex items-start justify-between w-full'>
          <div className='flex items-center justify-start gap-[var(--px-24)]'>
            <img src={ArrowBigDownSvg} alt="Arrow Big Down" className="w-[var(--px-43)] h-[var(--px-44)]" />
            <div className='text-[length:var(--px-59)] font-helvetica uppercase font-light leading-[var(--px-64)]'>
              DROP A TRACK
            </div>
          </div>
          <div className='text-[length:var(--px-13)] font-extralight font-auger opacity-50 text-right'>
            Simplicity and minimalism.<br />Just upload a sound, and Resomix will listen.
          </div>
        </div>
        <div className='text-[length:var(--px-59)] font-helvetica uppercase font-light leading-[var(--px-64)]'>
          AND EXPLORE NEW POSSIBILITIES
        </div>
      </div>
      <div className="w-full flex justify-center items-center pt-[var(--px-60)] pb-[var(--px-140)] min-h-[var(--px-309)]">
        <ButtonHeavyRight text="Align With Your Sound" onClick={() => { }} transparent={true} />
      </div>
      <div className='flex flex-col justify-start items-start mt-[var(--px-200)]'>
        {/* <div className="min-h-[var(--px-309)]"></div> */}
        <div className='flex justify-center items-start w-full mt-[var(--px-60)] gap-[var(--px-235)] opacity-50 min-h-[var(--px-121-5)]'>
          <div className="flex flex-col min-w-[var(--px-136-4)] justify-start items-start">
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="machine_listening..."
              />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="resonance_activated();"
                delay={700}
              />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="waveform::quantized"
                delay={1200}
              />
            </div>
            <div className="w-full my-[var(--px-4)]">
              <img src={LineThreeSvg} alt="Line Three" className="w-[var(--px-3)] h-[var(--px-29)]" />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="loop_density &gt; 97%"
                delay={1700}
              />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="feedback_loop::stable"
                delay={2200}
              />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)] leading-[var(--px-32)]">
              <CodeTyping
                speed={50}
                text="spectral_analysis..."
                delay={2700}
              />
            </div>
          </div>
          <div className="flex flex-col justify-start items-end min-w-[var(--px-117-8)]">
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)]">
              <CodeTyping
                speed={50}
                text="AI.sync.beatmap[OK]"
              />
            </div>
            <div className="text-[length:var(--px-7)] font-extralight font-fira tracking-[var(--px-2)] leading-[var(--px-32)]">
              <CodeTyping
                speed={50}
                text="sound.check: PASS"
                delay={3800}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default SextionSeven;
