import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function SaFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="sa-final sa-section" id="sa-cta">
      <div className="sa-frame">
        <h2 className="sa-h2b uppercase">{t('syncAgencies.cta.h2')}</h2>
        <p className="sa-body">{t('syncAgencies.cta.line')}</p>
        <div className="sa-ctas">
          <button
            type="button"
            className="sa-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('syncAgencies.cta.pilot')}
          </button>
          <button
            type="button"
            className="sa-cta-s uppercase"
            onClick={() => navigate('/contact')}
          >
            {t('syncAgencies.cta.contact')}
          </button>
          <button
            type="button"
            className="sa-tlink uppercase"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('syncAgencies.cta.exploreCi')}
          </button>
        </div>
      </div>
    </section>
  );
}
