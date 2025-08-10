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
        <div className="flex flex-col w-full gap-[var(--px-500)] mt-[var(--px-450)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-190)] w-[var(--px-700)] -right-[var(--px-200)] pointer-events-none z-5">
                    <img src={GradientFive} alt="gradient_five" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-500)] w-[var(--px-550)] -left-[var(--px-100)] pointer-events-none z-5">
                    <img src={GradientSix} alt="gradient_six" style={{ mixBlendMode: "lighten" }} className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex w-full z-15 items-end justify-between">
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        Resomix searches across catalogs and archives using carefully developed similarity patterns.
                        <br />
                        <span className="font-extralight">
                            Popularity metrics are not taken into account in the research, which is why our platform makes it easier to<br />uncover hidden gems, unknown albums, and artists flying under the radar.
                        </span>
                    </div>
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)] text-right">
                        Beyond<br />Trends
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-100)] w-full z-15 items-center">
                <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]">
                    Values &<br />Benefits
                </div>
                <div className="flex flex-col gap-[var(--px-100)] items-start ml-[var(--px-120)]">
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={AnalysisSvg} alt="analysis" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Discovery Based on Sound
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                Resomix starts off by reading the spectral flow of the audio provided. It compares<br />rhythm, tone, and spectral fingerprints of music online until it finds the right fits.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={CraftSvg} alt="craft" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Simplicity and Efficiency
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                Resomix's interface is fast, focused, and intuitive: simply drag, drop, and dig.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={ReferenceSvg} alt="reference" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Real Inclusion
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                Here, underrepresented artists and genres can find their audience and thrive,<br />with a discovery engine that prioritizes sonic similarities above all else.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SpeedSvg} alt="speed" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Built For Speed
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                By sampling micro-transients in real time, Resomix delivers fast, latency-tested results.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SoundWavesTwo} alt="sound waves" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Open by Nature
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                Transparent data, open APIs, and clear licensing. Resomix makes it easy for partners,<br />labels, platforms,and developers to collaborate and create a more open music ecosystem.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={LayersSvg} alt="layers" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                Quality over Quantity
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                Resomix filters results with care, and lets you control how many recommendations you <br />see every time.
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={MatchesSvg} alt="matches" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                The Art of Crate Digging
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                You still make the call; we only help you get there quicker. Resomix is a platform that'll<br />broaden your sonic horizon by exposing you to songs that might never appear through<br />standard search or streaming algorithms.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutThree;

