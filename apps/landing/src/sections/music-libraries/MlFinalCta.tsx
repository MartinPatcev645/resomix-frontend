import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function MlFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="ml-final ml-section" id="ml-cta">
      <div className="ml-frame">
        <h2 className="ml-h2b uppercase">{t('musicLibraries.cta.h2')}</h2>
        <p className="ml-body">{t('musicLibraries.cta.line')}</p>
        <div className="ml-ctas">
          <button
            type="button"
            className="ml-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('musicLibraries.cta.pilot')}
          </button>
          <button
            type="button"
            className="ml-cta-s uppercase"
            onClick={() => navigate('/developers')}
          >
            {t('musicLibraries.cta.exploreApi')}
          </button>
          <button
            type="button"
            className="ml-tlink uppercase"
            onClick={() => navigate('/contact')}
          >
            {t('musicLibraries.cta.contact')}
          </button>
        </div>
      </div>
    </section>
  );
}
