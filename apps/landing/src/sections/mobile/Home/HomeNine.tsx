import React, { useRef } from "react";
import { useOnScreen } from "@resomix/hooks";
import SectionNineGraphic from "@/assets/icons/composites/mobile/section_nine_graphic.svg";
import { GoldenSpiral, CodeTyping, ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const HomeNine: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useOnScreen(sectionRef, "600px 0px 600px 0px");
  return (
    <div ref={sectionRef} className="mt-[var(--px-120)] relative z-15">
      <div className="mb-[var(--px-100)]">
        <div className="flex justify-center w-full min-w-[var(--px-204-5)]">
          <ButtonHeavyRight text="Upload Your Track" onClick={() => {
            window.location.href = BASE_BETA_URL
          }} link_arrow={true} />
        </div>
      </div>
      <div className="absolute top-[var(--px-945)] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[var(--px-393)] h-[var(--px-393)]">
        {isVisible && <GoldenSpiral />}
      </div>
      {/* Content with higher z-index */}
      <div className="flex flex-col justify-between relative z-15">
        {/* Section 9 A */}
        <div className="flex flex-col justify-between min-h-[var(--px-403)]">
          <div className="mt-[var(--px-40)] text-center text-[length:var(--px-10)] font-light font-fira tracking-[var(--px-1-2)]">
            <div className="leading-[var(--px-8)]">
              <CodeTyping
                speed={50}
                text="upload(track.wav) → extract_sonic_DNA()"
              />
            </div>
            <div className="leading-[var(--px-12)]">
              <CodeTyping
                speed={50}
                text="deep_sonic_analysis(mode=granular)"
              />
            </div>
            <div className="leading-[var(--px-24)]">
              <CodeTyping
                speed={50}
                text="let result = Resomix.listen(input: feeling)"
                delay={800}
              />
            </div>
            <div className="leading-[var(--px-24)]">
              <CodeTyping
                speed={50}
                text="init.crate_digging(powered_by_AI)"
                delay={1100}
              />
            </div>
            <div className="leading-[var(--px-40)]">
              <CodeTyping
                speed={50}
                text="system.listens() ∴ you.create()"
                delay={2200}
              />
            </div>
            <div className="">
              <CodeTyping
                speed={50}
                text=":: tune_into(the_unknown)"
                delay={3300}
              />
            </div>
          </div>
          <div className="flex flex-col items-center text-center text-[length:var(--px-10)] font-light font-fira min-h-[var(--px-184)] mt-[var(--px-60)]">
            <div className="leading-[var(--px-32)] min-h-[var(--px-32)] tracking-[var(--px-1-2)]">
              <CodeTyping
                speed={50}
                text="// ML.engine::Enhancing_Human_Creativity()"
              />
            </div>
            <div className="mb-[var(--px-32)] min-h-[var(--px-8)] tracking-[var(--px-1-2)]">
              <CodeTyping
                speed={50}
                text="neural_waveform"
                delay={1100}
              />
            </div>
            <div className="leading-[var(--px-8)] min-h-[var(--px-8)] tracking-[var(--px-1-2)]">
              <CodeTyping
                speed={50}
                text="wave_resonance &gt;&gt;&gt;"
                delay={1100}
              />
            </div>
            <div className="leading-[var(--px-8)] tracking-[var(--px-1-2)]">
              <CodeTyping
                speed={50}
                text="blending &gt;&gt;"
                delay={2100}
              />
            </div>
          </div>
        </div>

        {/* Section 9 B */}
        <div className="flex flex-col justify-between mt-[var(--px-160)] gap-[var(--px-220)] w-full items-center">
          <div className="text-[length:var(--px-10)] font-light font-fira tracking-[var(--px-1-5)]">
            A New Era of Music
          </div>
          <img src={SectionNineGraphic} draggable={false} className="w-[var(--px-394)] h-[var(--px-6)]" alt="Section Nine Graphic" />
          <div className="text-[length:var(--px-10)] font-light font-fira tracking-[var(--px-1-5)]">
            Tune Into the Unknown
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeNine;
