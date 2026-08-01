import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function RlFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="rl-final rl-section" id="rl-cta">
      <div className="rl-frame">
        <h2 className="rl-h2b uppercase">{t('recordLabels.cta.h2')}</h2>
        <p className="rl-body">{t('recordLabels.cta.line')}</p>
        <div className="rl-ctas">
          <button
            type="button"
            className="rl-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('recordLabels.cta.pilot')}
          </button>
          <button
            type="button"
            className="rl-cta-s uppercase"
            onClick={() => navigate('/contact')}
          >
            {t('recordLabels.cta.contact')}
          </button>
          <button
            type="button"
            className="rl-tlink uppercase"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('recordLabels.cta.exploreCi')}
          </button>
        </div>
      </div>
    </section>
  );
}
