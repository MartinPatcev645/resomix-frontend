import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

/* S13 · Choose a way in — two route-plates, matching the PoClosing structure. */
export function AbClosing() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="ab-closing ab-section" id="ab-s13">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.closing.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.closing.h2')}</h2>

        <div className="ab-routes">
          <div className="ab-route-plate ab-chamfer">
            <h3>{t('about.closing.public.title')}</h3>
            <p>{t('about.closing.public.body')}</p>
            <div className="ab-cta-row">
              <button
                type="button"
                className="ab-btn ab-primary"
                onClick={() => {
                  window.location.href = BASE_BETA_URL;
                }}
              >
                {t('about.closing.public.ctaPrimary')}
              </button>
              <button
                type="button"
                className="ab-text-link"
                onClick={() => navigate('/product/track-intelligence')}
              >
                {t('about.closing.public.ctaSecondary')}
              </button>
            </div>
          </div>
          <div className="ab-route-plate ab-partner ab-chamfer">
            <h3>{t('about.closing.partner.title')}</h3>
            <p>{t('about.closing.partner.body')}</p>
            <div className="ab-cta-row">
              <button type="button" className="ab-btn" onClick={() => navigate('/partners/pilot')}>
                {t('about.closing.partner.ctaPrimary')}
              </button>
              <button
                type="button"
                className="ab-text-link"
                onClick={() => navigate('/product/catalog-intelligence')}
              >
                {t('about.closing.partner.ctaSecondary')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
