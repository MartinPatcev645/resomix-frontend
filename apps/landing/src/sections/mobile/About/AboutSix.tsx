import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"

const AboutSix: React.FC = () => {
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-150)] items-center mt-[var(--px-400)] relative z-20">
            {/* For Rightholders */}
            <div className="flex flex-col w-full items-center gap-[var(--px-20)]">
                <div className="flex flex-col items-end w-full justify-center gap-[var(--px-10)] z-20 mb-[var(--px-20)]">
                    <img src={ArrowBigDownSvg} draggable={false} aria-hidden="true" loading="lazy" alt="arrow_big_down_stroke" className="w-[var(--px-31)] h-[var(--px-29)] transform rotate-90" />
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-center">
                        FOR RIGHTS HOLDERS & PARTNERS
                    </div>
                </div>
                <div className="text-[length:var(--px-18)] font-helvetica leading-[var(--px-20)] text-center mx-[var(--px-10)] font-light tracking-[var(--px-0-5)] z-20">
                    Resomix is built to activate dormant catalogue - surfacing long-tail content that traditional discovery methods overlook, regardless of popularity metrics, release date, or editorial placement. During our demo phase, we use exclusively CC BY 4.0 licensed content to demonstrate the PYXIS-1 engine's capabilities. As we transition to commercial operations, we're building partnerships with rights holders who want to unlock the full value of their catalogue through sonic discovery.
                </div>
                <img src={SoundWavesTwo} draggable={false} aria-hidden="true" loading="lazy" alt="sound_waves_two" className="w-[var(--px-41)] h-[var(--px-50)]" />
                <div className="text-[length:var(--px-18)] font-helvetica leading-[var(--px-20)] text-center font-light tracking-[var(--px-0-5)] mx-[var(--px-10)]">
                    We offer transparent revenue sharing, DDEX-compliant reporting, non-exclusive terms, and complete catalogue control. Let's talk. licensing@resomix.com
                </div>
            </div>
        </div>
    );
};

export default AboutSix;
