import React from "react";
import { ButtonHeavyRight } from "@resomix/ui";
import SectionNineGraphic from "../assets/icons/composites/section_nine_graphic.svg";
import qrCodeGif from "../assets/gifs/qr_code.gif";

const SectionNine: React.FC = () => (
  <div className="mt-[var(--px-200)] px-[var(--px-65)] relative z-15">
    {/* QR Code Animation Background */}
    <div
      style={{
        backgroundImage: `url(${qrCodeGif})`,
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        position: 'absolute',
        width: 'var(--px-520)',
        height: 'var(--px-520)',
        top: 'var(--px-585)',
        left: '50%',
        opacity: 1,
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
      }}
    />
    {/* Content with higher z-index */}
    <div className="flex flex-col justify-between relative z-15">
      {/* Section 9 A */}
      <div className="flex justify-between mx-[var(--px-250)]">
        <div className="mt-[var(--px-40)] text-left text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
          <div className="leading-[var(--px-8)]">
            upload(track.wav) → extract_sonic_DNA()
          </div>
          <div className="leading-[var(--px-12)]">
            deep_sonic_analysis(mode=granular)
          </div>
          <div className="leading-[var(--px-32)]">
            let result = Resomix.listen(input: feeling)          </div>
          <div className="leading-[var(--px-32)]">
            init.crate_digging(powered_by_AI)
          </div>
          <div className="leading-[var(--px-64)]">
            system.listens() ∴ you.create()
          </div>
          <div className="">
            :: tune_into(the_unknown)
          </div>
        </div>
        <div className="flex flex-col items-end text-right text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
          <div className="leading-[var(--px-32)]">
          // ML.engine::Enhancing_Human_Creativity()
          </div>
          <div className="mb-[var(--px-32)]">
            neural_waveform
          </div>
          <div className="leading-[var(--px-8)]">
            wave_resonance &gt;&gt;&gt;
          </div>
          <div className="leading-[var(--px-8)]">
            blending &gt;&gt;
          </div>
          <div className="w-full flex justify-end mt-[var(--px-50)]">
            <ButtonHeavyRight text="resomix" onClick={() => { }} transparent={true} />
          </div>
        </div>
      </div>

      {/* Section 9 B */}
      <div className="mt-[var(--px-400)]">
        <div className="flex justify-between mx-[var(--px-240)] -mb-[var(--px-6)]">
          <div className="text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)] ml-[var(--px-20)]">
            A New Era of Music
          </div>
          <div className="text-[length:var(--px-7)] font-light font-fira opacity-50 tracking-[var(--px-2)]">
            Tune Into the Unknown
          </div>
        </div>
        <img src={SectionNineGraphic} className="w-[var(--px-1280)] h-[var(--px-4)]" alt="Section Nine Graphic" />
      </div>
    </div>
  </div>
);

export default SectionNine;
