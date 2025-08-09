import React from "react";
import ArrowSmallUp from "@/assets/icons/arrow_small_up.svg"
import PlaySvg from "@/assets/icons/play.svg"

const AboutFour: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-300)] mt-[var(--px-400)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                <div className="flex justify-between items-start">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-50)]">
                        <span className="ml-[var(--px-100)]">Who<br /></span>
                        <div className="flex items-center gap-[var(--px-10)]">
                            <img src={ArrowSmallUp} alt="arrow_small_up" className="w-[var(--px-43)] h-[var(--px-43)]" />
                            Resomix<br />
                        </div>
                        <span className="ml-[var(--px-53)]">is for</span>
                    </div>
                    <div className="flex flex-col items-start mr-[var(--px-100)] gap-[var(--px-20)]">
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    DJs
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    — who need the perfect tracks to make their sets unforgettable.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    Producers
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    — looking for new inspiration to reflect a song's vibe.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    Curators
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    — who create cohesive playlists with their unique taste.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    Music Enthusiasts
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    — exploring the boundaries of music, beyond charts or trends.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-400)] w-full z-15">
                <div className="text-[length:var(--px-25)] font-extralight font-helvetica uppercase leading-[var(--px-25)] tracking-[var(--px-5)] text-left w-full">
                    Resomix is run by DJs, engineers,<br />and music professionals
                </div>
                <div className="flex flex-col items-end w-full">
                    <div className="text-[length:var(--px-25)] font-extralight font-helvetica uppercase leading-[var(--px-25)] tracking-[var(--px-5)] text-right">
                        who want to build a better way<br />to discover and enjoy music across genres
                    </div>
                    <div className="text-[length:var(--px-17)] font-extralight font-helvetica leading-[var(--px-25)] tracking-[var(--px-1)] underline opacity-80 hover:opacity-100 transition-opacity duration-100 hover:cursor-pointer text-right w-full">
                        Reach us anytime: hello@resomix.com
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutFour;
