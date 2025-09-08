import React from "react";
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import AnalysisSvg from "@/assets/icons/analysis.svg"
import MatchesSvg from "@/assets/icons/matches.svg"
import CraftSvg from "@/assets/icons/craft.svg"
import GradientThree from "@/assets/images/gradient 3.png"
import GradientFour from "@/assets/images/gradient 4.png"
import { useTranslation } from 'react-i18next';

const AboutTwo: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <div className="flex flex-col w-full gap-[var(--px-150)] mt-[var(--px-450)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                {/* Graphics Overlay */}
                <div className="absolute -top-[var(--px-200)] w-[var(--px-520)] left-[var(--px-320)] pointer-events-none z-5">
                    <img src={GradientThree} alt="gradient_three" className="w-full h-auto" />
                </div>
                <div className="absolute top-[var(--px-500)] w-[var(--px-550)] -left-[var(--px-300)] pointer-events-none z-5">
                    <img src={GradientFour} alt="gradient_four" className="w-full h-auto" />
                </div>

                {/* Content */}
                <div className="flex flex-col gap-[var(--px-20)] w-full items-center relative z-15">
                    <div className="text-[length:var(--px-26)] font-helvetica font-extralight leading-[var(--px-26)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_two.preamble_one') }}>
                    </div>
                    <img src={AboutSeparatorLineTwo} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                    <div className="text-[length:var(--px-26)] font-helvetica font-extralight leading-[var(--px-26)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_two.preamble_two') }}>
                    </div>
                </div>
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]">
                        {t('about.about_two.vision_title')}
                    </div>
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        {t('about.about_two.vision_intro')}
                        <br />
                        <span className="font-extralight" dangerouslySetInnerHTML={{ __html: t('about.about_two.vision_span') }}>
                        </span>
                    </div>
                </div>
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-60)] w-full z-15">
                <div className="flex flex-col gap-[var(--px-10)] w-full z-15">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] ml-[var(--px-60)]" dangerouslySetInnerHTML={{ __html: t('about.about_two.diff_title') }}>
                    </div>
                    <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)]">
                        {t('about.about_two.diff_intro')}
                        <br />
                        <span className="font-extralight" dangerouslySetInnerHTML={{ __html: t('about.about_two.diff_span') }}>
                        </span>
                    </div>
                </div>
                <div className="flex gap-[var(--px-30)] w-full items-start justify-start">
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={AnalysisSvg} alt="analysis" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]">
                            {t('about.about_two.card_analysis_title')}
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]">
                            {t('about.about_two.card_analysis_desc')}
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={CraftSvg} alt="craft" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]">
                            {t('about.about_two.card_craft_title')}
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]" dangerouslySetInnerHTML={{ __html: t('about.about_two.card_craft_desc') }}>
                        </div>
                    </div>
                    <div className="flex-1/3 flex flex-col items-start justify-start w-full gap-[var(--px-20)]">
                        <img src={MatchesSvg} alt="matches" className="w-[var(--px-45)] h-[var(--px-46)]" />
                        <div className="flex-1/3 text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-22)]" dangerouslySetInnerHTML={{ __html: t('about.about_two.card_path_title') }}>
                        </div>
                        <div className="flex-1/3 text-[length:var(--px-17)] font-helvetica font-extralight tracking-[var(--px-1)]" dangerouslySetInnerHTML={{ __html: t('about.about_two.card_path_desc') }}>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutTwo;
