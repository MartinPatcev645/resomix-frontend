import React from "react";
import MatchesSvg from "@/assets/icons/matches.svg"
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
                <div className="absolute top-[var(--px-100)] w-[var(--px-394)] -left-[var(--px-20)] pointer-events-none z-5">
                    <img src={GradientSix} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_six" className="w-full h-[var(--px-1720)]" />
                </div>

                {/* Content */}
                <div className="flex flex-col w-full z-15 items-end justify-between">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-right">
                        Beyond<br />Trends
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] mt-[var(--px-40)]">
                        <div className="text-[length:var(--px-18)] font-helvetica font-medium flex flex-col gap-[var(--px-10)] text-left">
                            Every catalog has a hidden layer - tracks that never made it to charts, albums that fell through algorithmic cracks, artists who create brilliant work outside the spotlight. Resomix was built to find them
                        </div>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-100)] w-full z-15 items-center">
                <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-center ml-[var(--px-30)]">
                    What We Stand For
                </div>
                <div className="flex flex-col gap-[var(--px-100)] items-start">
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SpeedSvg} draggable={false} aria-hidden="true" loading="lazy" alt="speed" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                THE ART OF CRATE DIGGING
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                You still make the call. We help you get there faster - surfacing tracks that standard search and streaming algorithms miss
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SoundWavesTwo} draggable={false} aria-hidden="true" loading="lazy" alt="sound waves" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                REAL INCLUSION
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                When discovery is based on sonic character alone, every artist competes on equal terms - regardless of label size, marketing budget, or chart history
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={LayersSvg} draggable={false} aria-hidden="true" loading="lazy" alt="layers" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                OPEN BY NATURE
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Transparent data, clear licensing, and an open approach to partnerships. Built for labels, platforms, and developers to collaborate with
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={MatchesSvg} draggable={false} aria-hidden="true" loading="lazy" alt="matches" className="w-[var(--px-52)] h-[var(--px-52)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                PRECISION OVER VOLUME
                            </div>
                            <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                Fewer results, higher relevance. You control how many recommendations you see every time
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutThree;

