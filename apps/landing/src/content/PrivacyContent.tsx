import { Link } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { BASE_LANDING_URL } from "@resomix/config";

export default function PrivacyContent() {
    const { t } = useTranslation('common');
    return (
        <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0">
            <div className="w-full flex flex-col items-center text-[var(--color-primary)]">

                <header className="mb-[var(--px-28)] text-center">
                    <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica">{t('privacy.title')}</h1>
                    <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                        {t('privacy.subheading')}
                    </p>
                    <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
                        {t('privacy.last_updated')}
                    </p>
                </header>

                <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
                    <div className="mb-[var(--px-24)]">
                        <Link to={BASE_LANDING_URL} className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica tracking-[var(--px-1)] hover:text-[var(--color-primary-hover)] transition-colors">← {t('general.back_to_home')}</Link>
                    </div>

                    <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                        {t('privacy.description')}
                    </p>

                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">
                            {t('privacy.information_we_collect')}
                        </h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.information_we_collect_1')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.information_we_collect_2')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.information_we_collect_3')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.information_we_collect_4')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.information_we_collect_5')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.how_we_use')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.how_we_use_1')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.how_we_use_2')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.how_we_use_3')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.how_we_use_4')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.how_we_use_5')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.how_we_use_6')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.data_retention')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.data_retention_1')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.data_security')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.data_security_1')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.your_rights')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.your_rights_1')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.your_rights_2')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.your_rights_3')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.your_rights_4')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.your_rights_5')}
                        </p>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
                            {t('privacy.your_rights_6')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.changes_to_policy')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.changes_to_policy_1')}
                        </p>
                    </section>
                    <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
                        <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('privacy.contact_us')}</h2>
                        <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
                            {t('privacy.contact_us_1')}
                            <a href="mailto:privacy@resomix.com" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary-hover-hover)] transition-colors"> privacy@resomix.com</a>.
                        </p>
                    </section>
                </div>
            </div>
        </section>
    );
}
