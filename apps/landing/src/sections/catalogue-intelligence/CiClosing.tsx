import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* S9 · Closing CTA — chamfered close plate. Transplanted verbatim from the
   approved preview. */
export function CiClosing() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="ci-closing ci-section" id="ci-s9">
      <div className="ci-wrap">
        <div className="ci-close-plate ci-chamfer">
          <div className="ci-eyebrow">{t('catalogueIntelligence.closing.eyebrow')}</div>
          <h2 className="ci-h2">{t('catalogueIntelligence.closing.h2')}</h2>
          <p className="ci-body-p ci-copycol">{t('catalogueIntelligence.closing.body')}</p>
          <div className="ci-cta-row">
            <button
              type="button"
              className="ci-btn ci-primary"
              onClick={() => navigate('/partners/pilot')}
            >
              {t('catalogueIntelligence.closing.ctaPrimary')}
            </button>
            <button
              type="button"
              className="ci-btn"
              onClick={() => navigate('/product/track-intelligence')}
            >
              {t('catalogueIntelligence.closing.ctaSecondary')}
            </button>
          </div>
          <p className="ci-support-line">{t('catalogueIntelligence.closing.support')}</p>
        </div>
      </div>
    </section>
  );
}
