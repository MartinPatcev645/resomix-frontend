import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import SectionNineGraphic from "../assets/icons/composites/section_nine_graphic.svg";

const SectionNine: React.FC = () => (
  <div className="mt-[200px] px-[45px] relative z-15">
    <div className="flex flex-col justify-between">
      {/* Section 9 A */}
      <div className="flex justify-between mx-[250px]">
        <div className="mt-[40px] text-left text-[7px] font-light font-fira opacity-50 tracking-[2px]">
          <div className="leading-2">
            upload(track.wav) → extract_sonic_DNA()
          </div>
          <div className="leading-3">
            deep_sonic_analysis(mode=granular)
          </div>
          <div className="leading-8">
            let result = Resomix.listen(input: feeling)          </div>
          <div className="leading-8s">
            init.crate_digging(powered_by_AI)
          </div>
          <div className="leading-16">
            system.listens() ∴ you.create()
          </div>
          <div className="">
            :: tune_into(the_unknown)
          </div>
        </div>
        <div className="flex flex-col items-end text-right text-[7px] font-light font-fira opacity-50 tracking-[2px]">
          <div className="leading-8">
          // ML.engine::Enhancing_Human_Creativity()
          </div>
          <div className="mb-8">
            neural_waveform
          </div>
          <div className="leading-2">
            wave_resonance &gt;&gt;&gt;
          </div>
          <div className="leading-2">
            blending &gt;&gt;
          </div>
          <div className="w-full flex justify-end mt-[50px]">
            <ButtonHeavyRight text="resomix" onClick={() => {}} transparent={true} />
          </div>
        </div>
      </div>

      {/* Section 9 B */}
      <div className="mt-[400px]">
        resomix 9B
        <img src={SectionNineGraphic} alt="Section Nine Graphic" />
      </div>
    </div>
  </div>
);

export default SectionNine;
