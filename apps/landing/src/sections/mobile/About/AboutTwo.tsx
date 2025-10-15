import React from "react";
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import AnalysisSvg from "@/assets/icons/analysis.svg"
import MatchesSvg from "@/assets/icons/matches.svg"
import CraftSvg from "@/assets/icons/craft.svg"
import GradientThree from "@/assets/images/gradient 3.png"
import GradientFour from "@/assets/images/gradient 4.png"

const AboutTwo: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-200)] mt-[var(--px-280)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-300)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-120)] w-[var(--px-400)] -left-[var(--px-20)] pointer-events-none z-5">
                    <img src={GradientThree} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_three" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-300)] w-[var(--px-700)] -left-[var(--px-400)] pointer-events-none z-5">
                    <img src={GradientFour} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_four" className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-[var(--px-10)] w-full items-center relative z-15">
                    <div className="text-[length:var(--px-18)] font-helvetica font-light leading-[var(--px-18)] text-center">
                        What we care about is that you find the right track for the right moment,
                        the one that can galvanize your audience and make you stand out as a DJ.
                    </div>
                    <img src={AboutSeparatorLineTwo} draggable={false} aria-hidden="true" loading="lazy" alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                    <div className="text-[length:var(--px-18)] font-helvetica font-light leading-[var(--px-18)] text-center">
                        We're here to make that process faster, more intuitive,
                        and based on what matters the most: the music.
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-left">
                        Our Vision
                    </div>
                    <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-medium flex flex-col gap-[var(--px-10)]">
                        We believe you deserve better tools to craft your set and explore the depth of your musical taste.
                        <span className="font-light">
                            Resomix finds hidden connections because we know that music doesn't need a high chart position to be relevant. The platform analyzes every aspect of a song's structure, to map its sonic DNA and find a perfect match, regardless of who released it or when.
                        </span>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-100)] w-full z-15">
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-left">
                        What makes<br />resomix<br />different
                    </div>
                    <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-medium flex flex-col gap-[var(--px-10)]">
                        Our music discovery system is based on a deep learning algorithm that identifies musical patterns on a granular level.
                        <span className="font-light">
                            Playing outside of the "streaming game," Resomix can find unknown tunes and hidden gems that reflect the essence of your reference.
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-50)] w-full items-start justify-start">
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={AnalysisSvg} draggable={false} aria-hidden="true" loading="lazy" alt="analysis" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            Deeper Sound Analysis
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            No artificial curation, no shortcutting the research; just an innovative way of doing audio analysis through deep learning algorithms.
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={CraftSvg} draggable={false} aria-hidden="true" loading="lazy" alt="craft" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            Technology and Craft
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            Resomix explores what defines a track: its subtlety, dynamics, flow, rhythm, texture, energy, and more. Just like when DJs read the room while performing, our deep-learning engine delivers personalized results based on hard data, not trends.
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={MatchesSvg} draggable={false} aria-hidden="true" loading="lazy" alt="matches" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            A Faster Path<br />to the Right Track
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            Within seconds, you'll have a carefully crafted selection of tracks that resonate with your reference's vibe, regardless of genre, release date, or popularity.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutTwo;
