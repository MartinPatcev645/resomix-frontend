import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BETA_ANALYSIS_URL } from '@/components/Navigation/navData.ts';

export function TiFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section id="ti-cta" className="ti-section" aria-label="Get started">
      <div className="ti-final">
        <div>
          <p className="ti-eyebrow uppercase">{t('trackIntelligence.cta.leftEyebrow')}</p>
          <h2 className="ti-h2b uppercase">{t('trackIntelligence.cta.leftTitle')}</h2>
          <div className="ti-ctarow">
            <a className="ti-pill ti-pill-solid uppercase" href={BETA_ANALYSIS_URL}>
              {t('trackIntelligence.cta.leftBtn')}
            </a>
          </div>
          <span className="ti-lbl ti-note uppercase">{t('trackIntelligence.cta.leftNote')}</span>
        </div>
        <div className="ti-finaldiv" aria-hidden="true" />
        <div>
          <p className="ti-eyebrow uppercase">{t('trackIntelligence.cta.rightEyebrow')}</p>
          <h2 className="ti-h3b uppercase">{t('trackIntelligence.cta.rightTitle')}</h2>
          <div className="ti-ctarow">
            <button
              type="button"
              className="ti-pill ti-pill-line uppercase"
              onClick={() => navigate('/partners/pilot')}
            >
              {t('trackIntelligence.cta.rightBtn')}
            </button>
          </div>
          <span className="ti-lbl-dim ti-note">{t('trackIntelligence.cta.rightNote')}</span>
        </div>
      </div>
    </section>
  );
}
