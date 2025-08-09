import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import AboutSeparatorLineSvg from "@/assets/icons/about_section_one_line.svg"
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"
import GradientTwo from "@/assets/images/gradient 2.png"
import { CodeTyping } from "@resomix/ui";

const AboutOne: React.FC = () => {
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-500)] items-center mt-[var(--px-100)] relative z-20">
            {/* Section 1 A */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="absolute w-[var(--px-700)] left-[16%] z-1">
                    <img src={GradientTwo} alt="gradient_two" className="w-full h-auto" />
                </div>
                <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] z-20">
                    Our Mission
                </div>
                <div className="flex items-end w-full justify-center gap-[var(--px-20)] mr-[var(--px-50)] z-20">
                    <img src={ArrowBigDownSvg} alt="arrow_big_down_stroke" className="w-[var(--px-49)] h-[var(--px-49)] transform -rotate-90" />
                    <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                        Putting together a set that tells a story is no trivial task.<br />
                        Tracks that perfectly fit (tonally and emotionally) with our mix are often<br />hard to find, especially now that most platforms focus more on tags<br />and popularity metrics rather than intention and vibe.
                    </div>
                </div>
                <img src={AboutSeparatorLineSvg} alt="about_section_one_line" className="w-[var(--px-4)] h-[var(--px-115)] z-20" />
            </div>

            {/* Section 1 B */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="text-[length:var(--px-58)] font-light font-helvetica uppercase leading-[var(--px-60)] text-center">
                    Resomix shows an alternative route<br />
                    to superficial music matches
                </div>
                <img src={AboutSeparatorLineSvg} alt="about_section_one_line" className="w-[var(--px-4)] h-[var(--px-115)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    We use advanced audio analysis and deep learning technology<br />W
                    to truly understand a song: from tempo shifts to harmonic<br />
                    tension, dynamic range, and more.
                </div>
                <img src={SoundWavesTwo} alt="sound_waves_two" className="w-[var(--px-31)] h-[var(--px-38)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center">
                    The result is a music recommendation based on emotion<br />
                    and structure, and not just labels or metadata.
                </div>
                <img src={AboutSeparatorLineTwo} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-2)] text-center">
                    <CodeTyping
                        text="run(vibe_exploration_mode)<br />→ output: connection_through_emotion<br />→ status: inspired"
                        multiline={true}
                        speed={100}
                    />
                </div>
            </div>

        </div>
    );
};

export default AboutOne;
