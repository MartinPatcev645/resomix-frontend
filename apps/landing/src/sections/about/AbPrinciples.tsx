import { useTranslation } from 'react-i18next';

/* S6 · Principles — four plates + chain-note. Geometry transplanted verbatim
   from the approved preview (`#ab-s6`). */
export function AbPrinciples() {
  const { t } = useTranslation('common');

  return (
    <section className="ab-sec ab-section" id="ab-s6">
      <div className="ab-wrap">
        <div className="ab-eyebrow">{t('about.principles.eyebrow')}</div>
        <h2 className="ab-h2">{t('about.principles.h2')}</h2>
        <p className="ab-body-p ab-copycol">{t('about.principles.intro')}</p>

        <div className="ab-principles">
          <div className="ab-pr">
            <span className="ab-n">01</span>
            <h3>{t('about.principles.p1.title')}</h3>
            <p>{t('about.principles.p1.body')}</p>
          </div>
          <div className="ab-pr">
            <span className="ab-n">02</span>
            <h3>{t('about.principles.p2.title')}</h3>
            <p>{t('about.principles.p2.body')}</p>
          </div>
          <div className="ab-pr">
            <span className="ab-n">03</span>
            <h3>{t('about.principles.p3.title')}</h3>
            <p>{t('about.principles.p3.body')}</p>
          </div>
          <div className="ab-pr">
            <span className="ab-n">04</span>
            <h3>{t('about.principles.p4.title')}</h3>
            <p>{t('about.principles.p4.body')}</p>
          </div>
        </div>

        <div className="ab-chain-note">
          <p>{t('about.principles.chainNote.body')}</p>
          <svg viewBox="0 0 200 44" width="200" aria-label={t('about.principles.chainNote.figureAria')}>
            <rect x="6" y="16" width="24" height="14" fill="#EE4A26" />
            <path className="ab-sig" d="M 34 23 H 72" fill="none" stroke="#EE4A26" strokeWidth="1.4" />
            <rect x="76" y="16" width="24" height="14" fill="rgba(255,255,255,.85)" />
            <path d="M 104 23 H 142" fill="none" stroke="rgba(255,255,255,.4)" />
            <rect x="146" y="16" width="24" height="14" fill="rgba(255,255,255,.6)" />
          </svg>
        </div>
      </div>
    </section>
  );
}
