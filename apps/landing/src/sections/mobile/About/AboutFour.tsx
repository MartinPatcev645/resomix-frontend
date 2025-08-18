import React from "react";
import ArrowSmallUp from "@/assets/icons/arrow_small_up.svg"
import PlaySvg from "@/assets/icons/play.svg"
import { GoldenSpiral, ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const AboutFour: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-90)] mt-[var(--px-400)] relative z-20">
            <div className="absolute top-[var(--px-1059)] left-[50%] transform -translate-x-1/2 -translate-y-1/2 w-[var(--px-250)] h-[var(--px-250)]">
                <GoldenSpiral />
            </div>
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                <div className="flex flex-col gap-[var(--px-100)] items-start">
                    <div className="text-[length:var(--px-43)] font-medium font-helvetica uppercase leading-[var(--px-45)]">
                        <span className="ml-[var(--px-100)]">Who<br /></span>
                        <div className="flex items-center">
                            <img src={ArrowSmallUp} alt="arrow_small_up" className="w-[var(--px-32)] h-[var(--px-31)] mb-[var(--px-2)]" />
                            Resomix<br />
                        </div>
                        <span className="ml-[var(--px-53)]">is for</span>
                    </div>
                    <div className="flex flex-col items-start gap-[var(--px-30)]">
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    DJs
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — who need the perfect tracks to make their sets unforgettable.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Producers
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — looking for new inspiration to reflect a song's vibe.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Curators
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — who create cohesive playlists with their unique taste.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Music Enthusiasts
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — exploring the boundaries of music, beyond charts or trends.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="w-full flex justify-center items-center">
                <ButtonHeavyRight text="Try it Now" onClick={() => {
                    window.location.href = BASE_BETA_URL
                }} transparent={true} link_arrow={true} />
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-300)] w-full z-15">
                <div className="text-[length:var(--px-22)] font-helvetica uppercase leading-[var(--px-26)] tracking-[var(--px-0-5)] text-left w-full opacity-80">
                    Resomix is run<br />by DJs, engineers,<br />and music<br />professionals
                </div>
                <div className="flex flex-col items-end w-full">
                    <div className="text-[length:var(--px-22)] font-helvetica uppercase leading-[var(--px-26)] tracking-[var(--px-0-5)] text-right w-full opacity-80">
                        We want to build<br />a better way to<br />discover and enjoy<br />music across genres
                    </div>
                    <div className="text-[length:var(--px-14)] font-helvetica leading-[var(--px-16)] tracking-[var(--px-1)] underline hover:cursor-pointer text-right w-full mt-[var(--px-10)]">
                        Reach us anytime:<br />hello@resomix.com
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutFour;
