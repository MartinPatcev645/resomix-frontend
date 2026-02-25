import React from "react";
import GradientFive from "@/assets/images/gradient 5.png"

const AboutFive: React.FC = () => {
    return (
        <div className="flex flex-col w-full gap-[var(--px-300)] mt-[var(--px-400)] relative z-20 mb-[var(--px-200)]">
            <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)]">
                    The Team
                </div>
                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] flex flex-col gap-[var(--px-20)]">
                    Resomix was born from the same frustration  working DJ knows<br />- spending hours digging through fragmented platforms for one track that fits
                    <span className="font-extralight">
                        We're a small team of DJs, signal processing engineers, and music industry professionals based in Greece,<br />building the discovery tool we always wished existed
                    </span>
                    <span className="font-extralight">
                        Reform Studios · Thessaloniki, Greece Reach us anytime: <a href="mailto:support@resomix.com" className="font-light hover:underline">support@resomix.com</a>
                    </span>
                </div>
            </div>
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute top-[var(--px-300)] w-[var(--px-700)] -right-[var(--px-200)] pointer-events-none z-5">
                    <img src={GradientFive} aria-hidden="true" loading="lazy" draggable={false} alt="gradient_five" className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex w-full z-15 items-start justify-between">
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] flex flex-col gap-[var(--px-20)] font-extralight">
                        <div>
                            <span className="font-normal">“</span> I discovered electronic music through Italian progressive house radio in<br />the late 1990s. Two decades of DJing, producing, and running Reform Studios<br />taught me one thing: finding the right track is the hardest part of the creative process.
                        </div>
                        <div>
                            <span className="font-normal">Resomix is the tool I needed and couldn't find. Built on signal processing, not hype.”</span>
                        </div>
                        <div className="font-extralight">
                            — Georgios<br />Founder & CEO, Reform Studios
                        </div>
                    </div>
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)] text-right">
                        From the<br />Founder
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutFive;
