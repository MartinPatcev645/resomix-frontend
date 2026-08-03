import { useTranslation } from 'react-i18next';
import { useAbDefs } from './abDefs.ts';

/* S12 · From the founder — analogue radio-frequency line resolving into the present Resomix signal. */
export function AbFounder() {
  const { t } = useTranslation('common');
  const { url } = useAbDefs();
  const f = (key: string) => t(`about.figures.${key}`);

  return (
    <section className="ab-sec ab-section" id="ab-s12">
      <div className="ab-wrap ab-bleed">
        <div className="ab-stagebox">
          <div className="ab-grain" aria-hidden="true" />
          <svg className="ab-d-only" viewBox="0 0 1200 172" role="img" aria-label={t('about.founder.figureAriaD')}>
            <text x="60" y="48" fontSize="10" letterSpacing="1.4" fill="rgba(185,185,185,.92)">{f('italianRadio1990s')}</text>
            <path d="M 60 110 q 10 -26 20 0 q 10 26 20 0 q 10 -20 20 0 q 10 20 20 0 q 10 -30 20 0 q 10 24 20 0 q 10 -18 20 0 q 10 22 20 0 q 10 -26 20 0 q 10 20 20 0" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.4" />
            <path d="M 260 110 q 12 -18 24 0 q 12 18 24 0 q 12 -12 24 0 q 12 12 24 0 q 12 -20 24 0 q 12 14 24 0" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" />
            <path className="ab-sig" d="M 404 110 C 560 106, 780 104, 1010 104" fill="none" stroke="#EE4A26" />
            <text x="560" y="90" fontSize="9.5" letterSpacing="1.4" fill="rgba(185,185,185,.9)">{f('twentyYearsDjingProducing')}</text>
            <circle cx="1044" cy="104" r="22" fill={url('halo')} />
            <rect x="1032" y="97" width="24" height="14" fill="#EE4A26" />
            <line x1="1037" y1="104" x2="1051" y2="104" stroke="#101010" />
            <text x="1044" y="148" fontSize="10.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(255,255,255,.95)">{f('thessalonikiResomix')}</text>
          </svg>
          <svg className="ab-m-only" viewBox="0 0 390 200" role="img" aria-label={t('about.founder.figureAriaM')}>
            <text x="24" y="34" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.92)">{f('italianRadio1990s')}</text>
            <path d="M 24 84 q 8 -20 16 0 q 8 20 16 0 q 8 -14 16 0 q 8 14 16 0 q 8 -22 16 0 q 8 16 16 0" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1.3" />
            <path className="ab-sig" d="M 130 84 C 220 82, 280 82, 330 82" fill="none" stroke="#EE4A26" />
            <circle cx="348" cy="82" r="16" fill={url('halo')} />
            <rect x="339" y="76" width="18" height="11" fill="#EE4A26" />
            <text x="24" y="128" fontSize="12.3" letterSpacing=".9" fill="rgba(185,185,185,.9)">{f('twentyYearsDjingProducing')}</text>
            <text x="24" y="162" fontSize="12.3" letterSpacing="1.2" fill="rgba(255,255,255,.95)">{f('thessalonikiResomix')}</text>
          </svg>
        </div>
      </div>
      <div className="ab-wrap">
        <div className="ab-eyebrow" style={{ marginTop: '2.6rem' }}>{t('about.founder.eyebrow')}</div>
        <blockquote className="ab-founder-quote">
          <p>{t('about.founder.quote1')}</p>
          <p>{t('about.founder.quote2')}</p>
        </blockquote>
        <div className="ab-attrib">{t('about.founder.attrib')}</div>
      </div>
    </section>
  );
}
