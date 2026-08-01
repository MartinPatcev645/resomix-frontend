import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function PrFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="pr-final pr-section" id="pr-cta">
      <div className="pr-frame">
        <h2 className="pr-h2b uppercase">{t('producers.final.h2')}</h2>
        <p className="pr-body">{t('producers.final.body')}</p>
        <div className="pr-ctas">
          <a className="pr-cta-p uppercase" href={BASE_BETA_URL}>
            {t('producers.cta.start')}
          </a>
          <button
            type="button"
            className="pr-cta-s uppercase"
            onClick={() => navigate('/product/track-intelligence')}
          >
            {t('producers.cta.exploreTi')}
          </button>
        </div>
        <p className="pr-lbl-dim">{t('producers.hero.ctaNote')}</p>
      </div>
    </section>
  );
}
