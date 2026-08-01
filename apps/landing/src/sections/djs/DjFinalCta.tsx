import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function DjFinalCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="dj-final dj-section" id="dj-cta">
      <div className="dj-frame">
        <h2 className="dj-fh uppercase">
          <span>{t('djs.final.line1')}</span>
          <br />
          <span>{t('djs.final.line2')}</span>
          <br />
          <span className="dj-l3">{t('djs.final.line3')}</span>
        </h2>
        <div className="dj-ctas">
          <a className="dj-cta-p uppercase" href={BASE_BETA_URL}>
            {t('djs.cta.try')}
          </a>
          <button
            type="button"
            className="dj-cta-s uppercase"
            onClick={() => navigate('/product/sonic-discovery')}
          >
            {t('djs.cta.exploreSd')}
          </button>
          <button
            type="button"
            className="dj-tlink uppercase"
            onClick={() => navigate('/product/track-intelligence')}
          >
            {t('djs.cta.exploreTi')}
          </button>
        </div>
        <p className="dj-lbl-dim">{t('djs.hero.ctaNote')}</p>
      </div>
    </section>
  );
}
