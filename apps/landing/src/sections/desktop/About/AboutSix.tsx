import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"

const AboutSix: React.FC = () => {
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-300)] mt-[var(--px-350)] items-center relative z-20">
            {/* FOR RIGHTS HOLDERS */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="flex items-start w-full justify-center gap-[var(--px-20)] mr-[var(--px-50)] z-20">
                    <img src={ArrowBigDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="arrow_big_down_stroke" className="w-[var(--px-49)] h-[var(--px-49)] transform -rotate-90 mt-[var(--px-10)]" />
                    <div className="text-[length:var(--px-52)] text-center font-medium font-helvetica uppercase z-20">
                        FOR RIGHTS HOLDERS<br />& PARTNERS
                    </div>
                </div>
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center mt-[var(--px-20)]">
                    Resomix is built to activate dormant catalogue<br />Surfacing long-tail content that traditional discovery methods overlook,<br />regardless of popularity metrics, release date, or editorial placement.
                    <br />During our demo phase, we use exclusively CC BY 4.0 licensed content to demonstrate the<br />PYXIS-1 engine's capabilities. As we transition to commercial operations,<br />we're building partnerships with rights holders who want to unlock the full value of their catalogue through sonic discovery
                </div>
                <img src={SoundWavesTwo} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves_two" className="w-[var(--px-31)] h-[var(--px-38)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    We offer transparent revenue sharing, DDEX-compliant reporting, non-exclusive terms,<br />and complete catalogue control. Let's talk. licensing@resomix.com
                </div>
            </div>

        </div>
    );
};

export default AboutSix;
