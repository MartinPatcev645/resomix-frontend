import { useTranslation } from 'react-i18next';
import { BASE_BETA_URL } from '@resomix/config';
import { usePoDefs } from './poDefs.ts';

/* S4 · Sonic Discovery flow + ranked playlist. */
export function PoDiscovery() {
  const { t } = useTranslation('common');
  const { url } = usePoDefs();
  const f = (key: string) => t(`product.figures.${key}`);
  const rows = [1, 2, 3, 4, 5] as const;

  return (
    <section className="po-sec po-section" id="po-s4">
      <div className="po-wrap">
        <div className="po-eyebrow">{t('product.discovery.eyebrow')}</div>
        <h2 className="po-h2">{t('product.discovery.h2')}</h2>
        <div className="po-copycol">
          <p className="po-body-p">{t('product.discovery.body1')}</p>
          <p className="po-body-p">{t('product.discovery.body2')}</p>
        </div>
        <div className="po-cta-row">
          <button
            type="button"
            className="po-btn po-primary"
            onClick={() => {
              window.location.href = BASE_BETA_URL;
            }}
          >
            {t('product.discovery.cta')}
          </button>
        </div>
      </div>

      <div className="po-wrap po-bleed po-fig">
        <div className="po-stagebox">
          <div className="po-grain" aria-hidden="true" />
                <div className="po-flowgrid">

                  {/* ============ DISCOVERY FLOW · DESKTOP ============ */}
                  <svg className="po-d-only" viewBox="0 0 820 300" role="img" style={{padding: '1.2rem .4rem 1.2rem 1rem'}}
                       aria-label={t('product.discovery.figureAriaD')}>
                    <path d="M 24 40 h 168 l 10 10 v 40 h -178 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                    <text x="36" y="66" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.95)">{f('searchATrack')}</text>
                    <text x="24" y="108" fontSize="8.5" letterSpacing="1" fill="rgba(185,185,185,.85)">{f('existingProfileUsed')}</text>

                    <path d="M 24 138 h 168 l 10 10 v 40 h -178 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                    <text x="36" y="164" fontSize="8.5" letterSpacing="1.4" fill="rgba(255,255,255,.95)">{f('uploadAReference')}</text>
                    <text x="24" y="206" fontSize="8.5" letterSpacing="1" fill="rgba(185,185,185,.85)">{f('processedFirstLonger')}</text>

                    <path d="M 202 66 C 246 74, 266 98, 282 114" fill="none" stroke="rgba(238,74,38,.7)"/>
                    <path d="M 202 164 C 246 156, 266 132, 282 122" fill="none" stroke="rgba(238,74,38,.7)" strokeDasharray="3 4"/>
                    <circle cx="252" cy="142" r="3.5" fill="none" stroke="rgba(238,74,38,.6)"/>

                    <circle cx="300" cy="118" r="20" fill={url('halo')}/>
                    <circle cx="300" cy="118" r="8.5" fill="none" stroke="rgba(238,74,38,.5)"/>
                    <circle cx="300" cy="118" r="3.6" fill="#EE4A26"/>
                    <text x="300" y="84" fontSize="9.5" letterSpacing="1.8" textAnchor="middle" fill="rgba(255,255,255,.95)">{f('oneReference')}</text>

                    <path className="po-sig" d="M 312 118 H 372" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <g>
                      <circle cx="404" cy="118" r="15" fill="none" stroke="rgba(255,255,255,.5)"
                              strokeDasharray="60 34" transform="rotate(30 404 118)"/>
                      <rect x="399" y="113" width="10" height="10" fill="#0C0C0D" stroke="rgba(238,74,38,.85)" transform="rotate(45 404 118)"/>
                    </g>
                    <text x="404" y="156" fontSize="8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('sonicProfile')}</text>
                    <text x="404" y="170" fontSize="8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('retrievedOrCreated')}</text>

                    <path className="po-sig" d="M 420 118 H 486" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <rect x="498" y="56" width="200" height="124" fill="none" stroke="rgba(255,255,255,.3)" strokeDasharray="2 6"/>
                    <rect x="510" y="68" width="176" height="100" fill={url('cells')}/>
                    <rect x="510" y="68" width="176" height="100" fill={url('cellsMark')}/>
                    <text x="498" y="200" fontSize="8.5" letterSpacing="1.2" fill="rgba(255,255,255,.95)">{f('comparePreAnalysed')}</text>
                    <text x="498" y="216" fontSize="8" letterSpacing="1" fill="rgba(185,185,185,.82)">{f('notReanalysed')}</text>

                    <path className="po-sig" d="M 698 118 C 740 118, 764 118, 806 118" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <text x="420" y="272" fontSize="9" letterSpacing="1.8" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('rankedAutomatically')}</text>
                  </svg>

                  {/* ============ DISCOVERY FLOW · MOBILE ============ */}
                  <svg className="po-m-only" viewBox="0 0 390 520" role="img" style={{padding: '1rem .6rem'}}
                       aria-label={t('product.discovery.figureAriaM')}>
                    <path d="M 20 20 h 342 l 8 8 v 38 h -350 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                    <text x="32" y="46" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.95)">{f('searchATrack')}</text>
                    <text x="358" y="46" fontSize="7.4" letterSpacing=".8" textAnchor="end" fill="rgba(185,185,185,.85)">{f('existingProfileUsed')}</text>
                    <text x="195" y="86" fontSize="7" letterSpacing="2" textAnchor="middle" fill="rgba(185,185,185,.4)">{f('or')}</text>
                    <path d="M 20 98 h 342 l 8 8 v 38 h -350 z" fill="#17171A" stroke="rgba(255,255,255,.28)"/>
                    <text x="32" y="124" fontSize="8" letterSpacing="1.2" fill="rgba(255,255,255,.95)">{f('uploadAReference')}</text>
                    <text x="358" y="138" fontSize="7.4" letterSpacing=".8" textAnchor="end" fill="rgba(185,185,185,.85)">{f('processedFirstLonger')}</text>

                    <path className="po-sig" d="M 195 146 V 176" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <circle cx="195" cy="196" r="16" fill={url('halo')}/>
                    <circle cx="195" cy="196" r="3.4" fill="#EE4A26"/>
                    <text x="195" y="230" fontSize="9" letterSpacing="1.5" textAnchor="middle" fill="rgba(255,255,255,.95)">{f('oneReference')}</text>

                    <path className="po-sig" d="M 195 240 V 268" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <text x="195" y="292" fontSize="8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('sonicProfileRetrievedOrCreated')}</text>

                    <path className="po-sig" d="M 195 302 V 328" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <rect x="70" y="334" width="250" height="108" fill="none" stroke="rgba(255,255,255,.3)" strokeDasharray="2 6"/>
                    <rect x="82" y="346" width="226" height="84" fill={url('cells')}/>
                    <rect x="82" y="346" width="226" height="84" fill={url('cellsMark')}/>
                    <text x="70" y="462" fontSize="8" letterSpacing="1" fill="rgba(255,255,255,.95)">{f('comparePreAnalysed')}</text>
                    <text x="70" y="476" fontSize="7.4" letterSpacing=".9" fill="rgba(185,185,185,.82)">{f('notReanalysed')}</text>
                    <path className="po-sig" d="M 195 442 V 492" fill="none" stroke="#EE4A26" strokeWidth="1.5"/>
                    <text x="195" y="512" fontSize="7.8" letterSpacing="1.1" textAnchor="middle" fill="rgba(255,255,255,.94)">{f('rankedAutomatically')}</text>
                  </svg>

                  {/* the playlist */}
                  <aside className="po-flowlist">
                      <div className="po-flowlist-label">
                        <span className="po-arrow">→</span> {t('product.discovery.playlistLabel')}
                      </div>
                      <div className="po-rlist">
                        {rows.map((n) => (
                          <div
                            key={n}
                            className={`po-rrow${n === 1 ? ' po-top' : ''} po-resolve d${n}`}
                          >
                            <span className="po-pl" aria-hidden="true">
                              {f('play')}
                            </span>
                            <span className="po-rk">{f(`rank0${n}`)}</span>
                            <span className="po-ti">
                              {t(`product.discovery.rows.r${n}title`)}
                              <span className="po-ar">{t(`product.discovery.rows.r${n}artist`)}</span>
                            </span>
                            <span className="po-sc">{t(`product.discovery.rows.r${n}score`)}</span>
                          </div>
                        ))}
                      </div>
                    </aside>
                </div>
        </div>
      </div>
    </section>
  );
}
