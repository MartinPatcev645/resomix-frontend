import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function SdFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="sd-cta" className="sd-section" aria-label="Get started">
      <div className="sd-final">
        <div>
          <p className="sd-eyebrow uppercase">{t('sonicDiscovery.cta.leftEyebrow')}</p>
          <h2 className="sd-h2b uppercase">{t('sonicDiscovery.cta.leftTitle')}</h2>
          <div className="sd-ctarow">
            <a
              className="sd-pill sd-pill-solid uppercase"
              href={BASE_BETA_URL}
            >
              {t('sonicDiscovery.cta.leftBtn')}
            </a>
          </div>
          <span className="sd-lbl sd-note block mt-[var(--px-14)]">{t('sonicDiscovery.cta.leftNote')}</span>
        </div>
        <div className="sd-finaldiv" aria-hidden="true" />
        <div>
          <p className="sd-eyebrow uppercase">{t('sonicDiscovery.cta.rightEyebrow')}</p>
          <h2 className="sd-h3b uppercase">{t('sonicDiscovery.cta.rightTitle')}</h2>
          <div className="sd-ctarow">
            <button
              type="button"
              className="sd-pill sd-pill-line uppercase"
              onClick={() => navigate('/product/catalogue-intelligence')}
            >
              {t('sonicDiscovery.cta.rightBtn')}
            </button>
            <button
              type="button"
              className="sd-bracket"
              onClick={() => navigate('/developers')}
            >
              {t('sonicDiscovery.cta.rightApi')}
            </button>
          </div>
          <span className="sd-lbl-dim sd-note block mt-[var(--px-14)]">{t('sonicDiscovery.cta.rightNote')}</span>
        </div>
      </div>
    </section>
  );
}
