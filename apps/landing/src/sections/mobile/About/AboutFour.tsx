import React from "react";
import ArrowSmallUp from "@/assets/icons/arrow_small_up.svg"
import PlaySvg from "@/assets/icons/play.svg"
import { ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";

const AboutFour: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-90)] mt-[var(--px-400)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                <div className="flex flex-col gap-[var(--px-100)] items-start">
                    <div className="text-[length:var(--px-43)] font-medium font-helvetica uppercase leading-[var(--px-45)]">
                        <span className="">Who</span>
                        <div className="flex items-center gap-[var(--px-10)]">
                            <img src={ArrowSmallUp} draggable={false} aria-hidden="true" loading="lazy" alt="arrow_small_up" className="w-[var(--px-32)] h-[var(--px-31)] mb-[var(--px-10)]" />
                            Resomix
                        </div>
                        <span className="">is for</span>
                    </div>
                    <div className="flex flex-col items-start gap-[var(--px-30)]">
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} draggable={false} aria-hidden="true" loading="lazy" alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    DJs
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — who need the right tracks for the right moment in their set
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} draggable={false} aria-hidden="true" loading="lazy" alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Producers
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — seeking sonic references for sound design, texture, and creative direction ideas
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} draggable={false} aria-hidden="true" loading="lazy" alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Curators
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — who build playlists around sonic cohesion, not genre labels
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-10)] z-15">
                            <img src={PlaySvg} draggable={false} aria-hidden="true" loading="lazy" alt="play" className="w-[var(--px-17)] h-[var(--px-19)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-medium font-helvetica uppercase leading-[var(--px-22)] text-left w-full">
                                    Music Enthusiasts
                                </div>
                                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-light text-left w-full leading-[var(--px-20)]">
                                    — who dig deeper than algorithms will take them
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="w-full flex justify-center items-center">
                <ButtonHeavyRight text="Upload a Track" onClick={() => {
                    window.location.href = BASE_BETA_URL
                }} transparent={true} link_arrow={true} className="cta-button secondary" id="about-four-try-now-button" />
            </div>
        </div>
    );
};

export default AboutFour;
