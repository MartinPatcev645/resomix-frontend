import React from "react";
import ArrowSmallUp from "@/assets/icons/arrow_small_up.svg"
import PlaySvg from "@/assets/icons/play.svg"
import { ButtonHeavyRight } from "@resomix/ui";
import { BASE_BETA_URL } from "@resomix/config";
import { useTranslation } from 'react-i18next';

const AboutFour: React.FC = () => {
    const { t } = useTranslation('common');
    return (
        <div className="flex flex-col w-full gap-[var(--px-120)] mt-[var(--px-400)] relative z-20">
            {/* About 2 A */}
            <div className="w-full flex flex-col gap-[var(--px-500)]">
                <div className="flex justify-between items-start">
                    <div className="text-[length:var(--px-52)] font-medium font-helvetica uppercase leading-[var(--px-50)]">
                        <span className="ml-[var(--px-100)]">{t('about.about_four.headline_who')}<br /></span>
                        <div className="flex items-center gap-[var(--px-10)]">
                            <img src={ArrowSmallUp} aria-label="arrow_small_up" loading="lazy" draggable={false} alt="arrow_small_up" className="w-[var(--px-43)] h-[var(--px-43)]" />
                            {t('about.about_four.headline_resomix')}<br />
                        </div>
                        <span className="ml-[var(--px-53)]">{t('about.about_four.headline_is_for')}</span>
                    </div>
                    <div className="flex flex-col items-start mr-[var(--px-100)] gap-[var(--px-20)]">
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" aria-label="play" loading="lazy" draggable={false} className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    {t('about.about_four.audience_djs_title')}
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    {t('about.about_four.audience_djs_desc')}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" aria-label="play" loading="lazy" draggable={false} className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    {t('about.about_four.audience_producers_title')}
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    {t('about.about_four.audience_producers_desc')}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" aria-label="play" loading="lazy" draggable={false} className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    {t('about.about_four.audience_curators_title')}
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    {t('about.about_four.audience_curators_desc')}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-[var(--px-20)] z-15">
                            <img src={PlaySvg} alt="play" aria-label="play" loading="lazy" draggable={false} className="w-[var(--px-13)] h-[var(--px-16)]" />
                            <div className="flex flex-col items-center gap-[var(--px-10)]">
                                <div className="text-[length:var(--px-22)] font-bold font-helvetica uppercase leading-[var(--px-16)] text-left w-full">
                                    {t('about.about_four.audience_music_enthusiasts_title')}
                                </div>
                                <div className="text-[length:var(--px-17)] font-helvetica tracking-[var(--px-1)] font-extralight text-left w-full leading-[var(--px-20)]">
                                    {t('about.about_four.audience_music_enthusiasts_desc')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Button */}
            <div className="w-full flex justify-center items-center">
                <ButtonHeavyRight text={t('about.about_four.cta_try_it_now')} onClick={() => {
                    window.location.href = BASE_BETA_URL
                }} transparent={true} link_arrow={true} className="cta-button secondary" id="about-four-try-now-button" />
            </div>

            {/* About 2 B */}
            <div className="flex flex-col gap-[var(--px-200)] w-full z-15">
                <div className="text-[length:var(--px-25)] font-extralight font-helvetica uppercase leading-[var(--px-25)] tracking-[var(--px-5)] text-left w-full" dangerouslySetInnerHTML={{ __html: t('about.about_four.run_by') }}>
                </div>
                <div className="flex flex-col items-end w-full">
                    <div className="text-[length:var(--px-25)] font-extralight font-helvetica uppercase leading-[var(--px-25)] tracking-[var(--px-5)] text-right" dangerouslySetInnerHTML={{ __html: t('about.about_four.mission') }}>
                    </div>
                    <div className="text-[length:var(--px-17)] font-extralight font-helvetica leading-[var(--px-25)] tracking-[var(--px-1)] underline opacity-80 hover:opacity-100 transition-opacity duration-100 hover:cursor-pointer text-right w-full contact-link" id="about-four-contact-email">
                        {t('about.about_four.contact_reach_us')} support@resomix.com
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutFour;
