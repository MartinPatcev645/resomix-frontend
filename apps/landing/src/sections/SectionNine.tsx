import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import SectionNineGraphic from "../assets/icons/composites/section_nine_graphic.svg";
import { GoldenSpiral } from "@resomix/ui";
import { CodeTyping } from "@resomix/ui";

const SectionNine: React.FC = () => (
  <div className="mt-[var(--px-240)] px-[var(--px-62)] mr-[var(--px-1)] relative z-15">
    <div className="absolute top-[var(--px-560)] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[var(--px-300)] h-[var(--px-300)] opacity-90">
      <GoldenSpiral />
    </div>
    {/* Content with higher z-index */}
    <div className="flex flex-col justify-between relative z-15">
      {/* Section 9 A */}
      <div className="flex justify-between mx-[var(--px-250)] min-h-[var(--px-198-5)]">
        <div className="mt-[var(--px-40)] text-left text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
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
          <div className="leading-[var(--px-32)]">
            <CodeTyping
              speed={50}
              text="let result = Resomix.listen(input: feeling)"
              delay={800}
            />
          </div>
          <div className="leading-[var(--px-32)]">
            <CodeTyping
              speed={50}
              text="init.crate_digging(powered_by_AI)"
              delay={1100}
            />
          </div>
          <div className="leading-[var(--px-64)]">
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
        <div className="flex flex-col items-end text-right text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)] min-h-[var(--px-184)]">
          <div className="leading-[var(--px-32)] min-h-[var(--px-32)]">
            <CodeTyping
              speed={50}
              text="// ML.engine::Enhancing_Human_Creativity()"
            />
          </div>
          <div className="mb-[var(--px-32)] min-h-[var(--px-8)]">
            <CodeTyping
              speed={50}
              text="neural_waveform"
              delay={1100}
            />
          </div>
          <div className="leading-[var(--px-8)] min-h-[var(--px-8)]">
            <CodeTyping
              speed={50}
              text="wave_resonance &gt;&gt;&gt;"
              delay={1100}
            />
          </div>
          <div className="leading-[var(--px-8)]">
            <CodeTyping
              speed={50}
              text="blending &gt;&gt;"
              delay={2100}
            />
          </div>
          <div className="w-full flex justify-end mt-[var(--px-50)]">
            <ButtonHeavyRight text="resomix" onClick={() => { }} transparent={true} />
          </div>
        </div>
      </div>

      {/* Section 9 B */}
      <div className="mt-[var(--px-350)]">
        <div className="flex justify-between mx-[var(--px-240)] -mb-[var(--px-6)]">
          <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-2)] ml-[var(--px-20)]">
            A New Era of Music
          </div>
          <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-2)]">
            Tune Into the Unknown
          </div>
        </div>
        <img src={SectionNineGraphic} className="max-w-full h-[var(--px-4)]" alt="Section Nine Graphic" />
      </div>
    </div>
  </div>
);

export default SectionNine;
