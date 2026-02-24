import React from "react";
import MatchesSvg from "@/assets/icons/matches.svg"
import SpeedSvg from "@/assets/icons/speed.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"
import LayersSvg from "@/assets/icons/layers.svg"
import GradientFive from "@/assets/images/gradient 5.png"
import GradientSix from "@/assets/images/gradient 6.png"
import { useTranslation } from 'react-i18next';

const AboutThree: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <div className="flex flex-col w-full gap-[var(--px-500)] mt-[var(--px-450)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-190)] w-[var(--px-700)] -right-[var(--px-200)] pointer-events-none z-5">
                    <img src={GradientFive} aria-hidden="true" loading="lazy" draggable={false} alt="gradient_five" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-300)] -left-[var(--px-63)] w-[var(--px-800)] pointer-events-none z-5">
                    <img src={GradientSix} aria-hidden="true" loading="lazy" draggable={false} alt="gradient_six" style={{ mixBlendMode: "lighten" }} className="w-full h-[var(--px-1200)]" />
                </div>

                {/* Content */}
                <div className="flex w-full z-15 items-end justify-between">
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        {t('about.about_three.intro')}
                        <br />
                        <span className="font-extralight" dangerouslySetInnerHTML={{ __html: t('about.about_three.intro_span') }}>
                        </span>
                    </div>
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)] text-right" dangerouslySetInnerHTML={{ __html: t('about.about_three.heading_beyond') }}>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-100)] w-full z-15 items-center">
                <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]" dangerouslySetInnerHTML={{ __html: t('about.about_three.heading_values_benefits') }}>
                </div>
                <div className="flex flex-col gap-[var(--px-100)] items-start ml-[var(--px-120)]">
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SpeedSvg} aria-hidden="true" loading="lazy" draggable={false} alt="speed" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                {t('about.about_three.card_speed_title')}
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                {t('about.about_three.card_speed_desc')}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={SoundWavesTwo} aria-hidden="true" loading="lazy" draggable={false} alt="sound waves" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                {t('about.about_three.card_open_title')}
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]" dangerouslySetInnerHTML={{ __html: t('about.about_three.card_open_desc') }}>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={LayersSvg} aria-hidden="true" loading="lazy" draggable={false} alt="layers" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                {t('about.about_three.card_quality_title')}
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]" dangerouslySetInnerHTML={{ __html: t('about.about_three.card_quality_desc') }}>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-[var(--px-20)] z-15">
                        <img src={MatchesSvg} aria-hidden="true" loading="lazy" draggable={false} alt="matches" className="w-[var(--px-45)] h-[var(--px-45)]" />
                        <div className="flex flex-col items-center gap-[var(--px-10)]">
                            <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                {t('about.about_three.card_crate_title')}
                            </div>
                            <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]" dangerouslySetInnerHTML={{ __html: t('about.about_three.card_crate_desc') }}>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutThree;

