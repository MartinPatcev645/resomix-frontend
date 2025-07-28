import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import SectionNineGraphic from "../assets/icons/composites/section_nine_graphic.svg";
import qrCodeGif from "../assets/gifs/qr_code.gif";

const SectionNine: React.FC = () => (
  <div className="mt-[200px] px-[65px] relative z-15">
    {/* QR Code Animation Background */}
    <div
      style={{
        backgroundImage: `url(${qrCodeGif})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        position: 'absolute',
        width: '520px',
        height: '520px',
        top: '585px',
        left: '50%',
        opacity: 1,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    />
    {/* Content with higher z-index */}
    <div className="flex flex-col justify-between relative z-15">
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
            <ButtonHeavyRight text="resomix" onClick={() => { }} transparent={true} />
          </div>
        </div>
      </div>

      {/* Section 9 B */}
      <div className="mt-[400px]">
        <div className="flex justify-between mx-[240px] -mb-[6px]">
          <div className="text-[7px] font-light font-fira opacity-50 tracking-[2px] ml-[20px]">
            A New Era of Music
          </div>
          <div className="text-[7px] font-light font-fira opacity-50 tracking-[2px]">
            Tune Into the Unknown
          </div>
        </div>
        <img src={SectionNineGraphic} alt="Section Nine Graphic" />
      </div>
    </div>
  </div>
);

export default SectionNine;
