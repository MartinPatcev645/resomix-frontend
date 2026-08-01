import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function McuFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="mcu-final mcu-section" id="mcu-cta">
      <div className="mcu-frame">
        <h2 className="mcu-h2b uppercase">{t('musicCurators.final.h2')}</h2>
        <p className="mcu-body">{t('musicCurators.final.body')}</p>
        <div className="mcu-ctas">
          <a className="mcu-cta-p uppercase" href={BASE_BETA_URL}>
            {t('musicCurators.cta.try')}
          </a>
          <button
            type="button"
            className="mcu-cta-s uppercase"
            onClick={() => navigate('/product/sonic-discovery')}
          >
            {t('musicCurators.cta.exploreSd')}
          </button>
          <button
            type="button"
            className="mcu-tlink uppercase"
            onClick={() => navigate('/product/track-intelligence')}
          >
            {t('musicCurators.cta.exploreTi')}
          </button>
        </div>
        <p className="mcu-lbl-dim">{t('musicCurators.hero.ctaNote')}</p>
      </div>
    </section>
  );
}
