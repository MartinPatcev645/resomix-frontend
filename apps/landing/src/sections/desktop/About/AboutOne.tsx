import React from "react";
import ArrowBigDownSvg from "@/assets/icons/arrow_big_down_stroke.svg"
import AboutSeparatorLineSvg from "@/assets/icons/about_section_one_line.svg"
import AboutSeparatorLineTwo from "@/assets/icons/about_section_one_line_2.svg"
import SoundWavesTwo from "@/assets/icons/sound_waves_2.svg"
import { CodeTyping, ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";
import { useTranslation } from 'react-i18next';

const AboutOne: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <div className="flex flex-col w-full justify-start gap-[var(--px-300)] items-center mt-[var(--px-100)] relative z-20">
            {/* Section 1 A */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-60)] z-20">
                    {t('about.about_one.headline_mission')}
                </div>
                <div className="flex items-end w-full justify-center gap-[var(--px-20)] mr-[var(--px-50)] z-20">
                    <img src={ArrowBigDownSvg} aria-hidden="true" loading="lazy" draggable={false} alt="arrow_big_down_stroke" className="w-[var(--px-49)] h-[var(--px-49)] transform -rotate-90" />
                    <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_one.mission_paragraph') }}>
                    </div>
                </div>
                <img src={AboutSeparatorLineSvg} aria-hidden="true" loading="lazy" draggable={false} alt="about_section_one_line" className="w-[var(--px-4)] h-[var(--px-115)] z-20" />
            </div>

            {/* Section 1 B */}
            <div className="flex flex-col w-full items-center gap-[var(--px-40)]">
                <div className="text-[length:var(--px-58)] font-light font-helvetica uppercase leading-[var(--px-60)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_one.headline_alternative_route') }}>
                </div>
                <img src={AboutSeparatorLineSvg} aria-hidden="true" loading="lazy" draggable={false} alt="about_section_one_line" className="w-[var(--px-4)] h-[var(--px-115)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_one.tech_paragraph') }}>
                </div>
                <img src={SoundWavesTwo} aria-hidden="true" loading="lazy" draggable={false} alt="sound_waves_two" className="w-[var(--px-31)] h-[var(--px-38)]" />
                <div className="text-[length:var(--px-17)] font-helvetica opacity-70 font-light leading-[var(--px-20)] text-center" dangerouslySetInnerHTML={{ __html: t('about.about_one.result_paragraph') }}>
                </div>
                <img src={AboutSeparatorLineTwo} aria-hidden="true" loading="lazy" draggable={false} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="text-[length:var(--px-7)] font-light font-fira opacity-70 tracking-[var(--px-2)] text-center">
                    <CodeTyping
                        text={t('about.about_one.code_text')}
                        multiline={true}
                        speed={100}
                    />
                </div>
                <img src={AboutSeparatorLineTwo} aria-hidden="true" loading="lazy" draggable={false} alt="about_section_one_line_2" className="w-[var(--px-3)] h-[var(--px-61)]" />
                <div className="w-full flex justify-center items-center">
                    <ButtonHeavyRight text={t('about.about_one.cta_find_perfect')} onClick={() => {
                        window.location.href = BASE_BETA_URL
                    }} transparent={true} link_arrow={true} className="cta-button secondary" id="about-one-find-perfect-button" />
                </div>
            </div>

        </div>
    );
};

export default AboutOne;
