import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

/* S10 · Two-route conversion. */
export function PoClosing() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="po-closing po-section" id="po-s10">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.closing.eyebrow')}</div>
        <h2 className="po-h2">{t('product.closing.h2')}</h2>

        <div className="po-routes">
          <div className="po-route-plate po-chamfer">
            <h3>{t('product.closing.publicTitle')}</h3>
            <p>{t('product.closing.publicBody')}</p>
            <div className="po-cta-row">
              <button
                type="button"
                className="po-btn po-primary"
                onClick={() => {
                  window.location.href = BASE_BETA_URL;
                }}
              >
                {t('product.closing.publicCta')}
              </button>
              <button
                type="button"
                className="po-text-link"
                onClick={() => navigate('/product/track-intelligence')}
              >
                {t('product.closing.publicLink')}
              </button>
            </div>
          </div>
          <div className="po-route-plate po-partner po-chamfer">
            <h3>{t('product.closing.partnerTitle')}</h3>
            <p>{t('product.closing.partnerBody')}</p>
            <div className="po-cta-row">
              <button type="button" className="po-btn" onClick={() => navigate('/partners/pilot')}>
                {t('product.closing.partnerCta')}
              </button>
              <button type="button" className="po-text-link" onClick={() => navigate('/partners')}>
                {t('product.closing.partnerLink')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
