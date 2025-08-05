import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import SectionNineGraphic from "../assets/icons/composites/mobile/section_nine_graphic.svg";
import { GoldenSpiral } from "@resomix/ui";
import { CodeTyping } from "@resomix/ui";

const SectionNine: React.FC = () => (
  <div className="mt-[var(--px-240)] relative z-15">
    <div className="absolute top-[var(--px-800)] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[var(--px-300)] h-[var(--px-300)] opacity-90">
      <GoldenSpiral />
    </div>
    {/* Content with higher z-index */}
    <div className="flex flex-col justify-between relative z-15">
      {/* Section 9 A */}
      <div className="flex flex-col justify-between min-h-[var(--px-198-5)]">
        <div className="mt-[var(--px-40)] text-center text-[length:var(--px-6)] font-light font-fira opacity-50 tracking-[var(--px-1-2)]">
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
        <div className="flex flex-col items-center text-center text-[length:var(--px-6)] font-light font-fira min-h-[var(--px-184)] mt-[var(--px-60)]">
          <div className="opacity-50 leading-[var(--px-32)] min-h-[var(--px-32)] tracking-[var(--px-1-2)]">
            <CodeTyping
              speed={50}
              text="// ML.engine::Enhancing_Human_Creativity()"
            />
          </div>
          <div className="opacity-50 mb-[var(--px-32)] min-h-[var(--px-8)] tracking-[var(--px-1-2)]">
            <CodeTyping
              speed={50}
              text="neural_waveform"
              delay={1100}
            />
          </div>
          <div className="opacity-50 leading-[var(--px-8)] min-h-[var(--px-8)] tracking-[var(--px-1-2)]">
            <CodeTyping
              speed={50}
              text="wave_resonance &gt;&gt;&gt;"
              delay={1100}
            />
          </div>
          <div className="opacity-50 leading-[var(--px-8)] tracking-[var(--px-1-2)]">
            <CodeTyping
              speed={50}
              text="blending &gt;&gt;"
              delay={2100}
            />
          </div>
          <div className="flex justify-end mt-[var(--px-50)] min-w-[var(--px-204-5)]">
            <ButtonHeavyRight className="w-[var(--px-204-5)]" text="Upload Your Track" onClick={() => { }} transparent={true} />
          </div>
        </div>
      </div>

      {/* Section 9 B */}
      <div className="flex flex-col justify-between mt-[var(--px-220)] gap-[var(--px-171)] w-full items-center">
        <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-1-2)]">
          A New Era of Music
        </div>
        <img src={SectionNineGraphic} className="w-[var(--px-313)] h-[var(--px-4)]" alt="Section Nine Graphic" />
        <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-1-2)]">
          Tune Into the Unknown
        </div>
      </div>
    </div>
  </div>
);

export default SectionNine;
