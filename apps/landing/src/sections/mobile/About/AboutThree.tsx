import React from "react";
import AnalysisSvg from "@/assets/icons/analysis.svg"
import MatchesSvg from "@/assets/icons/matches.svg"
import CraftSvg from "@/assets/icons/craft.svg"
import ReferenceSvg from "@/assets/icons/reference.svg"
import SpeedSvg from "@/assets/icons/speed.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"
import LayersSvg from "@/assets/icons/layers.svg"
import GradientFive from "@/assets/images/gradient 5.png"
import GradientSix from "@/assets/images/gradient 6.png"

const AboutThree: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-300)] mt-[var(--px-350)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-150)] w-[var(--px-622)] -right-[var(--px-170)] pointer-events-none z-5">
                    <img src={GradientFive} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_five" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-500)] w-[var(--px-394)] -left-[var(--px-20)] pointer-events-none z-5">
                    <img src={GradientSix} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_six" className="w-full h-[var(--px-1720)]" />
                </div>

                {/* Content */}
                <div className="flex flex-col w-full z-15 items-end justify-between">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-right">
                        Beyond<br />Trends
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] mt-[var(--px-40)]">
                        <div className="text-[length:var(--px-18)] font-helvetica font-medium flex flex-col gap-[var(--px-10)] text-left">
                            Resomix searches across catalogs<br />and archives using carefully developed similarity patterns.
                            <br />
                            <span className="font-light text-justify">
                                Popularity metrics are not taken into account in the research, which is why our platform makes it easier to uncover hidden gems, unknown albums, and artists flying under the radar.
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-100)] w-full z-15 items-center">
                <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-center ml-[var(--px-30)]">
                    Values &<br />Benefits
                </div>
                <div className="flex flex-col gap-[var(--px-100)] items-start">
                    <div className="flex gap-[var(--px-10)] z-15">
                        <img src={AnalysisSvg} draggable={false} aria-hidden="true" loading="lazy" alt="analysis" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Discovery Based<br />on Sound
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Resomix starts off by reading the spectral flow of the audio provided. It compares rhythm, tone, and spectral fingerprints of music online until it finds the right fits.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={CraftSvg} draggable={false} aria-hidden="true" loading="lazy" alt="craft" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Simplicity<br />and Efficiency
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Resomix's interface is fast, focused, and intuitive: simply drag, drop, and dig.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={ReferenceSvg} draggable={false} aria-hidden="true" loading="lazy" alt="reference" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Real Inclusion
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Here, underrepresented artists and genres can find their audience and thrive, with a discovery engine that prioritizes sonic similarities above all else.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SpeedSvg} draggable={false} aria-hidden="true" loading="lazy" alt="speed" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Built For Speed
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                By sampling micro-transients in real time, Resomix delivers fast, latency-tested results.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SoundWavesTwo} draggable={false} aria-hidden="true" loading="lazy" alt="sound waves" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Open by Nature
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Transparent data, open APIs, and clear licensing. Resomix makes it easy for partners, labels, platforms,and developers to collaborate and create a more open music ecosystem.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={LayersSvg} draggable={false} aria-hidden="true" loading="lazy" alt="layers" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                Quality over Quantity
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Resomix filters results with care, and lets you control how many recommendations you  see every time.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={MatchesSvg} draggable={false} aria-hidden="true" loading="lazy" alt="matches" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                The Art<br />of Crate Digging
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                You still make the call; we only help you get there quicker. Resomix is a platform that'll broaden your sonic horizon by exposing you to songs that might never appear through standard search or streaming algorithms.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutThree;

