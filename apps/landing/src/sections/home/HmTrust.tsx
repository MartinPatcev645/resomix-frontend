import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function HmTrust() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="hm-section" id="hm-trust">
      <div className="hm-frame">
        <h2 className="hm-sr">{t('home.trust.srTitle')}</h2>
        <p className="hm-eyebrow uppercase">{t('home.trust.eyebrow')}</p>
        <div className="hm-trust-vis">
          <div className="hm-zones">
            <div className="hm-z">
              <span className="hm-zi" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="9" cy="9" r="7"/><path d="M9 5 V9 L12 11"/></svg></span>
              <span className="hm-zt">{t('home.trust.z1t')}</span>
              <span className="hm-zd">{t('home.trust.z1d')}</span>
            </div>
            <div className="hm-z">
              <span className="hm-zi" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="8" width="12" height="7" rx="1"/><path d="M6 8 V6 a3 3 0 0 1 6 0 v2"/></svg></span>
              <span className="hm-zt">{t('home.trust.z2t')}</span>
              <span className="hm-zd">{t('home.trust.z2d')}</span>
            </div>
            <div className="hm-z">
              <span className="hm-zi" aria-hidden="true"><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2 L15 4.5 V9 c0 4-2.6 6-6 7 -3.4-1-6-3-6-7 V4.5 Z"/></svg></span>
              <span className="hm-zt">{t('home.trust.z3t')}</span>
              <span className="hm-zd">{t('home.trust.z3d')}</span>
            </div>
          </div>
        </div>
        <div className="hm-trust-line">
          <button type="button" className="hm-tlink" onClick={() => navigate('/trust')}>
            {t('home.trust.link')}
          </button>
        </div>
      </div>
    </section>
  );
}
