import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function CiFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="ci-cta" className="ci-section" aria-label="Get started">
      <div className="ci-final">
        <div>
          <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.cta.leftEyebrow')}</p>
          <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.cta.leftTitle')}</h2>
          <div className="ci-ctarow">
            <button
              type="button"
              className="ci-pill ci-pill-solid uppercase"
              onClick={() => navigate('/partners/pilot')}
            >
              {t('catalogueIntelligence.cta.leftBtn')}
            </button>
          </div>
          <div className="ci-pilotnotes">
            {(t('catalogueIntelligence.cta.chips', { returnObjects: true }) as string[]).map((chip) => (
              <span key={chip} className="ci-chip">
                {chip}
              </span>
            ))}
          </div>
        </div>
        <div className="ci-finaldiv" aria-hidden="true" />
        <div>
          <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.cta.rightEyebrow')}</p>
          <h2 className="ci-h3b uppercase">{t('catalogueIntelligence.cta.rightTitle')}</h2>
          <div className="ci-ctarow">
            <button
              type="button"
              className="ci-pill ci-pill-line uppercase"
              onClick={() => navigate('/developers')}
            >
              {t('catalogueIntelligence.cta.rightBtn')}
            </button>
          </div>
          <span className="ci-lbl-dim block mt-[var(--px-14)]">{t('catalogueIntelligence.cta.rightNote')}</span>
        </div>
      </div>
    </section>
  );
}
