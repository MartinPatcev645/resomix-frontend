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
                        We care about one thing: that you find the right track for the right moment - the one that galvanizes your audience and sets you apart
                    </div>
                    <img src={AboutSeparatorLineTwo} draggable={false} aria-hidden="true" loading="lazy" alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                    <div className="text-[length:var(--px-18)] font-helvetica font-light leading-[var(--px-18)] text-center">
                        We're here to make that process faster,<br />more intuitive, and grounded in what<br />matters most: the music
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-left">
                        Our Vision
                    </div>
                    <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-medium flex flex-col gap-[var(--px-10)]">
                        A world where every track gets discovered on its own terms - not by chart position, not by marketing budget, not by release date
                        <span className="font-light text-[length:var(--px-17)]">
                            Resomix maps the full sonic DNA of a song's structure and finds its perfect match, regardless of who released it or when. That's what music discovery should be
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
                        Our discovery engine uses a computational algorithm that identifies musical patterns at the granular level
                        <span className="font-light">
                            Operating entirely outside the streaming ecosystem's popularity bias
                        </span>
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-50)] w-full items-start justify-start">
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={AnalysisSvg} draggable={false} aria-hidden="true" loading="lazy" alt="analysis" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            Spectral Feature Analysis
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            Pure signal processing. No artificial curation, no black-box AI - just deterministic audio analysis across 70+ sonic dimensions
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={CraftSvg} draggable={false} aria-hidden="true" loading="lazy" alt="craft" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            READS THE ROOM
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            PYXIS-1 maps a track's subtlety, dynamics, flow, rhythm, texture, and energy. Like a DJ reading the room, it responds to what the music actually communicates
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={MatchesSvg} draggable={false} aria-hidden="true" loading="lazy" alt="matches" className="w-[var(--px-54)] h-[var(--px-54)]" />
                        <div className="flex-1/3 text-[length:var(--px-20)] font-bold font-helvetica uppercase leading-[var(--px-20)]">
                            RESULTS IN SECONDS LIKE A DJ
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-18)] font-helvetica font-light tracking-[var(--px-0-5)]">
                            Within seconds, a precisely matched selection of tracks that share your reference's sonic character - regardless of genre, release date, or popularity
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutTwo;
