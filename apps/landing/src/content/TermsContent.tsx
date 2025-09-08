import { Link } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { BASE_LANDING_URL } from "@resomix/config";

export default function TermsContent() {
  const { t } = useTranslation('common');
  
  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">

        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica hidden lg:block">{t('terms.title')}</h1>
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica block lg:hidden" dangerouslySetInnerHTML={{ __html: t('terms.title_mobile') }}></h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
            {t('terms.subheading')}
          </p>
          <p className="mt-[var(--px-8)] text-[length:var(--px-10)] font-extralight opacity-80 font-helvetica tracking-[var(--px-1)]">
            {t('terms.last_updated')}
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
          <div className="mb-[var(--px-24)]">
            <Link to={BASE_LANDING_URL} className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica tracking-[var(--px-1)] hover:text-[var(--color-primary-hover)] transition-colors">← {t('general.back_to_home')}</Link>
          </div>

          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
            {t('terms.description')}
          </p>

          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.acceptance_of_terms')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.acceptance_of_terms_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.description_of_service')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.description_of_service_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.user_accounts')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.user_accounts_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.content_and_licensing')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.content_and_licensing_1')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.content_and_licensing_2')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.prohibited_uses')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.prohibited_uses_1')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
              {t('terms.prohibited_uses_2')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
              {t('terms.prohibited_uses_3')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
              {t('terms.prohibited_uses_4')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
              {t('terms.prohibited_uses_5')}
            </p>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)] ml-[var(--px-20)]">
              {t('terms.prohibited_uses_6')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.disclaimer_of_warranties')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.disclaimer_of_warranties_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.limitation_of_liability')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.limitation_of_liability_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.modifications_to_terms')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.modifications_to_terms_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.termination')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.termination_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.governing_law')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.governing_law_1')}
            </p>
          </section>
          <section className="flex flex-col gap-[var(--px-10)] mt-[var(--px-20)]">
            <h2 className="text-[length:var(--px-16)] font-semibold font-helvetica">{t('terms.contact_us')}</h2>
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica tracking-[var(--px-1)]">
              {t('terms.contact_us_1')}
              <a href="mailto:legal@resomix.com" className="text-[var(--color-primary-hover)] hover:text-[var(--color-primary-hover-hover)] transition-colors"> legal@resomix.com</a>.
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
