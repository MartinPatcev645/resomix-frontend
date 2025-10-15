import React, { useRef } from "react";
import ArrowBigDownSvg from "@/assets/icons/ArrowBigDown2.svg";
import LineThreeSvg from "@/assets/icons/line3.svg";
import { Terrain, ButtonHeavyRight, CodeTyping } from "@resomix/ui";
import { useOnScreen } from "@resomix/hooks";

const HomeSeven: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");
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
        {isVisible && (
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
        )}
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
        <div className="w-full flex justify-center items-center pb-[var(--px-140)] min-h-[var(--px-309)]">
          <ButtonHeavyRight className="w-[var(--px-280)] cta-button primary" text="Unlock a Universe of Sounds" onClick={() => { }} link_arrow={true} id="home-seven-unlock-button" />
        </div>
        <div className='flex flex-col justify-start items-start mt-[var(--px-200)]'>
          {/* <div className="min-h-[var(--px-309)]"></div> */}
          <div className='flex justify-between items-start w-full min-h-[var(--px-134)]'>
            <div className="flex flex-col min-w-[var(--px-136-4)] justify-start items-start">
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="machine_listening..."
                />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="resonance_activated();"
                  delay={700}
                />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="waveform::quantized"
                  delay={1200}
                />
              </div>
              <div className="w-full my-[var(--px-4)] flex justify-end items-center">
                <img src={LineThreeSvg} aria-hidden="true" loading="lazy" draggable={false} alt="Line Three" className="w-[var(--px-4)] h-[var(--px-45)]" />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="loop_density &gt; 97%"
                  delay={1700}
                />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="feedback_loop::stable"
                  delay={2200}
                />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)] leading-[var(--px-32)]">
                <CodeTyping
                  speed={50}
                  text="spectral_analysis..."
                  delay={2700}
                />
              </div>
            </div>
            <div className="flex flex-col justify-start items-end min-w-[var(--px-117-8)]">
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)]">
                <CodeTyping
                  speed={50}
                  text="AI.sync.beatmap[OK]"
                />
              </div>
              <div className=" text-[length:var(--px-10)] font-extralight font-fira tracking-[var(--px-2)] leading-[var(--px-32)]">
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

export default HomeSeven;
