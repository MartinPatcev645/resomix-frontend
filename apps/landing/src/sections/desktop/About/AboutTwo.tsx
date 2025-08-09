import React from "react";
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import AnalysisSvg from "@/assets/icons/analysis.svg"
import MatchesSvg from "@/assets/icons/matches.svg"
import CraftSvg from "@/assets/icons/craft.svg"
import GradientThree from "@/assets/images/gradient 3.png"
import GradientFour from "@/assets/images/gradient 4.png"

const AboutTwo: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-150)] mt-[var(--px-450)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-200)] w-[var(--px-520)] left-[var(--px-320)] pointer-events-none z-5">
                    <img src={GradientThree} alt="gradient_three" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-500)] w-[var(--px-550)] -left-[var(--px-300)] pointer-events-none z-5">
                    <img src={GradientFour} alt="gradient_four" className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-[var(--px-20)] w-full items-center relative z-15">
                    <div className="text-[length:var(--px-26)] font-helvetica font-extralight leading-[var(--px-26)] text-center">
                        What we care about is that you find the right track for the right moment,<br />
                        the one that can galvanize your audience and make you stand out as a DJ.
                    </div>
                    <img src={AboutSeparatorLineTwo} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                    <div className="text-[length:var(--px-26)] font-helvetica font-extralight leading-[var(--px-26)] text-center">
                        We're here to make that process faster, more intuitive,<br />
                        and based on what matters the most: the music.
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]">
                        Our Vision
                    </div>
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        We believe you deserve better tools to craft your set and explore the depth of your musical taste.
                        <br />
                        <span className="font-extralight">
                            Resomix finds hidden connections because we know that music doesn't need a high chart position to be relevant. The platform<br />analyzes every aspect of a song's structure, to map its sonic DNA and find a perfect match, regardless of who released it or when.
                        </span>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-60)] w-full z-15">
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]">
                        What makes<br />resomix different
                    </div>
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        Our music discovery system is based on a deep learning algorithm that identifies musical patterns on a granular level.
                        <br />
                        <span className="font-extralight">
                            Playing outside of the "streaming game," Resomix can find unknown tunes and hidden gems that reflect the essence<br />of your reference.
                        </span>
                    </div>
                </div>
                <div className="flex gap-[var(--px-30)] w-full items-start justify-start">
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={AnalysisSvg} alt="analysis" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]">
                            Deeper Sound Analysis
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]">
                            No artificial curation, no shortcutting the research; just an innovative way of doing audio analysis through deep learning algorithms.
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={CraftSvg} alt="craft" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]">
                            Technology and Craft
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]">
                            Resomix explores what defines<br />a track: its subtlety, dynamics, flow, rhythm,<br /> texture, energy, and more.<br />Just like when DJs read the room while<br />performing, our deep-learning engine delivers<br />personalized results based<br />on hard data, not trends.
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={MatchesSvg} alt="matches" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]">
                            A Faster Path<br />to the Right Track
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]">
                            Within seconds, you'll have a carefully crafted<br />selection of tracks that resonate with your<br />reference's vibe, regardless of genre, release<br />date, or popularity.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutTwo;
