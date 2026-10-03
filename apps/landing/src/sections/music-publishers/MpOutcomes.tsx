import { useTranslation, Trans } from 'react-i18next';
import { useMpDefs } from './mpDefs.ts';
import { BLOG } from '@/routes/blogLinks.ts';

/* S5 · Five publisher outcomes, each with its own micro-visual. */
export function MpOutcomes() {
  const { t } = useTranslation('common');
  const { url } = useMpDefs();

  return (
    <section className="mp-sec mp-section" id="mp-s5">
      <div className="mp-wrap">
        <p className="mp-body-p mp-lead-in">{t('musicPublishers.outcomes.leadIn')}</p>
        <div className="mp-cards">
          <div className="mp-card">
            <span className="mp-num">01</span>
            <h3>{t('musicPublishers.outcomes.c1.title')}</h3>
            <p><Trans i18nKey="musicPublishers.outcomes.c1.text" components={{ a: <a href={BLOG.backCatalogue} /> }} /></p>
            <div className="mp-mv">
              <svg viewBox="0 0 200 74" role="img" aria-label={t('musicPublishers.outcomes.c1.figureAria')}>
                <g fill="rgba(255,255,255,.1)">
                  <rect x="10" y="12" width="15" height="9" />
                  <rect x="34" y="12" width="15" height="9" />
                  <rect x="58" y="12" width="15" height="9" />
                  <rect x="82" y="12" width="15" height="9" />
                  <rect x="10" y="30" width="15" height="9" />
                  <rect x="58" y="30" width="15" height="9" />
                  <rect x="82" y="30" width="15" height="9" />
                  <rect x="10" y="48" width="15" height="9" />
                  <rect x="34" y="48" width="15" height="9" />
                  <rect x="82" y="48" width="15" height="9" />
                </g>
                <path
                  className="sig"
                  d="M 196 16 C 150 22, 92 26, 46 33"
                  fill="none"
                  stroke="#EE4A26"
                  strokeWidth="1.3"
                />
                <rect x="34" y="30" width="15" height="9" fill="rgba(255,255,255,.92)" className="resolve d1" />
                <rect x="31" y="27" width="21" height="15" fill="none" stroke="rgba(238,74,38,.75)" className="resolve d1" />
              </svg>
            </div>
          </div>

          <div className="mp-card">
            <span className="mp-num">02</span>
            <h3>{t('musicPublishers.outcomes.c2.title')}</h3>
            <p>{t('musicPublishers.outcomes.c2.text')}</p>
            <div className="mp-mv">
              <svg viewBox="0 0 200 74" role="img" aria-label={t('musicPublishers.outcomes.c2.figureAria')}>
                <rect x="8" y="6" width="184" height="62" fill="none" stroke="rgba(255,255,255,.16)" strokeDasharray="2 5" />
                <g fill="rgba(255,255,255,.55)">
                  <circle cx="48" cy="26" r="2" />
                  <circle cx="60" cy="34" r="2.4" />
                  <circle cx="40" cy="40" r="1.8" />
                  <circle cx="54" cy="46" r="2" />
                  <circle cx="118" cy="22" r="2" />
                  <circle cx="130" cy="30" r="2.4" />
                  <circle cx="124" cy="42" r="1.8" />
                  <circle cx="160" cy="48" r="2" />
                  <circle cx="170" cy="40" r="1.8" />
                  <circle cx="166" cy="56" r="2.2" />
                </g>
                <g fill="none" stroke="rgba(255,255,255,.22)">
                  <ellipse cx="51" cy="36" rx="22" ry="17" />
                  <ellipse cx="124" cy="32" rx="18" ry="15" />
                  <ellipse cx="165" cy="48" rx="15" ry="13" />
                </g>
              </svg>
            </div>
          </div>

          <div className="mp-card">
            <span className="mp-num">03</span>
            <h3>{t('musicPublishers.outcomes.c3.title')}</h3>
            <p>{t('musicPublishers.outcomes.c3.text')}</p>
            <div className="mp-mv">
              <svg viewBox="0 0 200 74" role="img" aria-label={t('musicPublishers.outcomes.c3.figureAria')}>
                <g fill="rgba(255,255,255,.35)">
                  <rect x="12" y="20" width="14" height="9" />
                  <rect x="12" y="36" width="14" height="9" />
                  <rect x="12" y="52" width="14" height="9" />
                </g>
                <g fill="rgba(255,255,255,.35)">
                  <rect x="174" y="20" width="14" height="9" />
                  <rect x="174" y="36" width="14" height="9" />
                  <rect x="174" y="52" width="14" height="9" />
                </g>
                <rect x="12" y="36" width="14" height="9" fill="rgba(255,255,255,.9)" />
                <rect x="174" y="20" width="14" height="9" fill="rgba(255,255,255,.9)" />
                <path d="M 26 40 C 70 40, 130 26, 174 25" fill="none" stroke="#EE4A26" strokeWidth="1.3" />
                <g stroke="rgba(255,255,255,.35)">
                  <line x1="66" y1="32" x2="66" y2="42" />
                  <line x1="100" y1="28" x2="100" y2="38" />
                  <line x1="134" y1="24" x2="134" y2="34" />
                </g>
                <text x="14" y="14" fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.5)">
                  {t('musicPublishers.figures.periodA')}
                </text>
                <text x="186" y="14" fontSize="7" letterSpacing="1" textAnchor="end" fill="rgba(185,185,185,.5)">
                  {t('musicPublishers.figures.periodB')}
                </text>
              </svg>
            </div>
          </div>

          <div className="mp-card">
            <span className="mp-num">04</span>
            <h3>{t('musicPublishers.outcomes.c4.title')}</h3>
            <p>{t('musicPublishers.outcomes.c4.text')}</p>
            <div className="mp-mv">
              <svg viewBox="0 0 200 74" role="img" aria-label={t('musicPublishers.outcomes.c4.figureAria')}>
                <circle cx="26" cy="37" r="12" fill={url('haloA')} />
                <circle cx="26" cy="37" r="3.2" fill="#EE4A26" />
                <path className="sig" d="M 32 37 H 96" fill="none" stroke="#EE4A26" strokeWidth="1.3" />
                <g className="resolve d1">
                  <rect x="104" y="14" width="16" height="10" fill="rgba(255,255,255,.9)" />
                  <rect x="101" y="11" width="22" height="16" fill="none" stroke="rgba(238,74,38,.7)" />
                </g>
                <g className="resolve d2">
                  <rect x="104" y="32" width="16" height="10" fill="rgba(255,255,255,.78)" />
                </g>
                <g className="resolve d3">
                  <rect x="104" y="50" width="16" height="10" fill="rgba(255,255,255,.66)" />
                </g>
                <g fontSize="7" letterSpacing="1" fill="rgba(185,185,185,.5)">
                  <text x="130" y="22">{t('musicPublishers.figures.wrk0447')}</text>
                  <text x="130" y="40">{t('musicPublishers.figures.wrk1180')}</text>
                  <text x="130" y="58">{t('musicPublishers.figures.wrk0921')}</text>
                </g>
              </svg>
            </div>
          </div>

          <div className="mp-card">
            <span className="mp-num">05</span>
            <h3>{t('musicPublishers.outcomes.c5.title')}</h3>
            <p>{t('musicPublishers.outcomes.c5.text')}</p>
            <div className="mp-mv">
              <svg viewBox="0 0 200 74" role="img" aria-label={t('musicPublishers.outcomes.c5.figureAria')}>
                <g fill="rgba(255,255,255,.55)">
                  <circle cx="34" cy="24" r="2" />
                  <circle cx="46" cy="32" r="2.2" />
                  <circle cx="30" cy="40" r="1.8" />
                  <circle cx="42" cy="48" r="2" />
                  <circle cx="56" cy="42" r="1.8" />
                  <circle cx="96" cy="50" r="2" />
                  <circle cx="108" cy="44" r="2.2" />
                  <circle cx="102" cy="58" r="1.8" />
                </g>
                <g fill="none" stroke="rgba(255,255,255,.22)">
                  <ellipse cx="43" cy="36" rx="22" ry="18" />
                  <ellipse cx="102" cy="50" rx="16" ry="13" />
                </g>
                <path d="M 128 12 h 58 v 34 h -58 z" fill="none" stroke="rgba(238,74,38,.6)" strokeDasharray="3 5" />
                <text x="157" y="32" fontSize="7" letterSpacing="1" textAnchor="middle" fill="rgba(238,74,38,.7)">
                  {t('musicPublishers.figures.openTerritory')}
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
