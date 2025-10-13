import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import AboutSeparatorLineSvg from "@/assets/icons/about_section_one_line.svg"
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"
import GradientTwo from "@/assets/images/gradient 2.png"
import { CodeTyping, ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const AboutOne: React.FC = () => {
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-300)] items-center mt-[var(--px-100)]relative z-20">
            {/* Section 1 A */}
            <div className="flex flex-col w-full items-center gap-[var(--px-10)]">
                <div className="absolute w-[var(--px-500)] -top-[var(--px-100)] z-5">
                    <img src={GradientTwo} draggable={false} alt="gradient_two" className="w-full h-auto" />
                </div>
                <div className="flex flex-col items-end w-full justify-center gap-[var(--px-10)] z-20">
                    <img src={ArrowBigDownSvg} draggable={false} alt="arrow_big_down_stroke" className="w-[var(--px-31)] h-[var(--px-29)] transform rotate-90" />
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-center">
                        Our Mission
                    </div>
                </div>
                <div className="text-[length:var(--px-18)] font-helvetica leading-[var(--px-20)] text-center mx-[var(--px-10)] font-light tracking-[var(--px-0-5)] z-20">
                    Putting together a set that tells a story is no trivial task.
                    Tracks that perfectly fit (tonally and emotionally) with our mix are often hard to find, especially now that most platforms focus more on tags and popularity metrics rather than intention and vibe.
                </div>
            </div>

            {/* Section 1 B */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)] z-20">
                <div className="text-[length:var(--px-28)] font-helvetica uppercase leading-[var(--px-28)] text-center">
                    Resomix shows an alternative route<br />
                    to superficial music matches
                </div>
                <img src={AboutSeparatorLineSvg} draggable={false} alt="about_section_one_line" className="w-[var(--px-4)] h-[var(--px-115)]" />
                <div className="text-[length:var(--px-18)] font-helvetica leading-[var(--px-20)] text-center font-light tracking-[var(--px-0-5)]">
                    We use advanced audio analysis and deep learning technology
                    to truly understand a song: from tempo shifts to harmonic
                    tension, dynamic range, and more.
                </div>
                <img src={SoundWavesTwo} draggable={false} alt="sound_waves_two" className="w-[var(--px-41)] h-[var(--px-50)]" />
                <div className="text-[length:var(--px-18)] font-helvetica leading-[var(--px-20)] text-center font-light tracking-[var(--px-0-5)] mx-[var(--px-10)]">
                    The result is a music recommendation based on emotion
                    and structure, and not just labels or metadata.
                </div>
                <img src={AboutSeparatorLineTwo} draggable={false} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-10)] font-light font-fira tracking-[var(--px-2)] text-center">
                    <CodeTyping
                        text="run(vibe_exploration_mode)<br />→ output: connection_through_emotion<br />→ status: inspired"
                        multiline={true}
                        speed={100}
                    />
                </div>
                <img src={AboutSeparatorLineTwo} draggable={false} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="w-full flex justify-center items-center">
                    <ButtonHeavyRight text="Find the Perfect Sonic Match" onClick={() => {
                        window.location.href = BASE_BETA_URL
                    }} transparent={true} link_arrow={true} className="cta-button secondary" id="about-one-find-perfect-button" />
                </div>
            </div>

        </div>
    );
};

export default AboutOne;
