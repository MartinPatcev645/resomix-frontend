import React from "react";
import GradientFive from "@/assets/images/gradient 5.png"

const AboutFive: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-350)] mt-[var(--px-400)] mb-[var(--px-200)] relative z-20">
            <div className="flex flex-col gap-[var(--px-40)] w-full z-15">
                <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-left">
                    The Team
                </div>
                <div className="text-[length:var(--px-18)] font-helvetica tracking-[var(--px-0-5)] font-medium flex flex-col gap-[var(--px-20)]">
                    Resomix was born from the same frustration  working DJ knows<br />- spending hours digging through fragmented platforms for one track that fits
                    <span className="font-light text-[length:var(--px-17)]">
                        We're a small team of DJs, signal processing engineers, and music industry professionals based in Greece, building the discovery tool we always wished existed
                    </span>
                    <span className="font-light text-[length:var(--px-17)]">
                        Resomix · Thessaloniki, Greece<br />Reach us anytime: <a href="mailto:support@resomix.com" className="font-light hover:underline">support@resomix.com</a>
                    </span>
                </div>
            </div>
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute top-[var(--px-530)] w-[var(--px-622)] -right-[var(--px-170)] pointer-events-none z-5">
                    <img src={GradientFive} draggable={false} aria-hidden="true" loading="lazy" alt="gradient_five" className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex flex-col w-full z-15 items-end justify-between">
                    <div className="text-[length:var(--px-43)] font-bold font-helvetica uppercase leading-[var(--px-43)] w-full text-right">
                        FROM THE FOUNDER
                    </div>
                    <div className="flex flex-col gap-[var(--px-10)] mt-[var(--px-40)]">
                        <div className="text-[length:var(--px-18)] font-helvetica font-extralight flex flex-col gap-[var(--px-20)] text-left">
                            <div>
                                <span className="font-normal">“</span> I discovered electronic music through Italian progressive house radio in the late 1990s. Two decades of DJing and producing taught me one thing: finding the right track is the hardest part of the creative process.
                            </div>
                            <div>
                                <span className="font-normal">Resomix is the tool I needed and couldn't find. Built on signal processing, not hype.”</span>
                            </div>
                            <div className="font-extralight">
                                — Georgios<br />Founder & CEO, Resomix
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutFive;
