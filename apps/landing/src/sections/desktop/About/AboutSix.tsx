import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"

const AboutSix: React.FC = () => {
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-300)] mt-[var(--px-350)] items-center relative z-20">
            {/* Section 1 B */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="flex items-center w-full justify-center gap-[var(--px-20)] mr-[var(--px-50)] z-20">
                    <img src={ArrowBigDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="arrow_big_down_stroke" className="w-[var(--px-49)] h-[var(--px-49)] transform -rotate-90 mb-[var(--px-10)]" />
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase z-20">
                        For Rightholders
                    </div>
                </div>
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center mt-[var(--px-20)]">
                    Some text here
                </div>
                <img src={SoundWavesTwo} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves_two" className="w-[var(--px-31)] h-[var(--px-38)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    Some text here
                </div>
                <img src={AboutSeparatorLineTwo} aria-hidden="true" loading="lazy" draggable={false} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
            </div>

        </div>
    );
};

export default AboutSix;
