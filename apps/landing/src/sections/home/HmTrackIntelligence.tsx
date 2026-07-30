import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

/* illustrative / fictional sample values */
const SAMPLE_KEY = 'G MIN · 6A';
const SAMPLE_BPM = '124 BPM';
const SAMPLE_LUFS = '−8.2 LUFS · LRA 6.4';
const SAMPLE_STYLE = 'Deep House';

export function HmTrackIntelligence() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="hm-section" id="hm-track-intelligence">
      <div className="hm-frame">
        <div className="hm-ti-head">
          <p className="hm-eyebrow uppercase">{t('home.trackIntelligence.eyebrow')}</p>
          <p className="hm-texture">{t('home.trackIntelligence.texture')}</p>
          <p className="hm-body">{t('home.trackIntelligence.body')}</p>
        </div>
        <figure className="hm-ti-comp" role="img" aria-label={t('home.trackIntelligence.figureAria')}>
          <div className="hm-ti-hud">
            <span className="hm-ti-hudlbl uppercase">{t('home.trackIntelligence.panelLabel')}</span>
            <span className="hm-ti-truth uppercase">{t('home.trackIntelligence.sampleData')}</span>
          </div>
          <div className="hm-ti-grid">
            <div className="hm-ti-art">
              <svg className="hm-sl hm-ti-desk" viewBox="0 0 760 324" aria-hidden="true">
              {/* callouts — one typographic step above prior SVG labels */}
              <g fontSize="14" style={{fill: '#d8d8d8'}}>
                <text x="16" y="26">{t('home.trackIntelligence.calloutRhythm')}</text>
                <text x="404" y="26">{t('home.trackIntelligence.calloutHarmony')}</text>
                <text x="16" y="132">{t('home.trackIntelligence.calloutEnergy')}</text>
                <text x="470" y="132" style={{fill: '#EE4A26'}}>{t('home.trackIntelligence.calloutPeaks')}</text>
                <text x="16" y="285">{t('home.trackIntelligence.calloutTimbre')}</text>
              </g>
              <g style={{color: 'rgba(255,255,255,.2)'}}>
                <path d="M118 30 C 150 42 170 52 188 60"/>
                <path d="M492 30 C 500 40 506 48 512 56"/>
                <path d="M96 136 C 110 148 122 158 134 168"/>
              </g>
              {/* waveform — context */}
              <g style={{color: 'rgba(255,255,255,.2)'}}>
                <path d="M16 74 l12-12 10 20 12-26 11 30 10-22 11 12 12-8 10 12 12-16 11 12 12-8 10 6 12-12 11 12 12-6 10 8 12-14 11 10 12-6 10 4 12-10 11 10 12-4 10 6 12-10 11 8 12-4 10 2 12-6 11 6 12-2 10 4 12-6 11 4 12-2 10 2 12-4 11 2"/>
              </g>
              {/* beat grid */}
              <g style={{color: 'rgba(255,255,255,.08)'}}>
                <line x1="16" y1="96" x2="16" y2="102"/><line x1="66" y1="96" x2="66" y2="102"/><line x1="116" y1="96" x2="116" y2="102"/><line x1="166" y1="96" x2="166" y2="102"/><line x1="216" y1="96" x2="216" y2="102"/><line x1="266" y1="96" x2="266" y2="102"/><line x1="316" y1="96" x2="316" y2="102"/><line x1="366" y1="96" x2="366" y2="102"/><line x1="416" y1="96" x2="416" y2="102"/><line x1="466" y1="96" x2="466" y2="102"/><line x1="516" y1="96" x2="516" y2="102"/><line x1="566" y1="96" x2="566" y2="102"/><line x1="616" y1="96" x2="616" y2="102"/><line x1="666" y1="96" x2="666" y2="102"/><line x1="716" y1="96" x2="716" y2="102"/>
              </g>
              {/* the drop moment line, aligned through every layer */}
              <line x1="460" y1="56" x2="460" y2="310" style={{color: 'rgba(238,74,38,.4)'}}/>
              {/* energy journey — primary */}
              <g style={{color: '#EE4A26'}}>
                <polyline points="16,236 76,226 130,202 190,198 236,216 292,210 340,206 400,196 460,152 552,148 640,166 716,196" style={{strokeWidth: 2.2}}/>
              </g>
              <circle cx="460" cy="152" r="5" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <circle cx="460" cy="152" r="10" style={{color: 'rgba(238,74,38,.35)'}}/>
              <circle cx="130" cy="202" r="3" style={{color: 'rgba(238,74,38,.55)'}}/>
              <circle cx="640" cy="166" r="3" style={{color: 'rgba(238,74,38,.55)'}}/>
              {/* structure */}
              <g fontSize="12" style={{color: 'rgba(255,255,255,.28)'}}>
                <rect x="16" y="246" width="112" height="26"/><rect x="134" y="246" width="150" height="26"/><rect x="290" y="246" width="122" height="26"/><rect x="418" y="246" width="196" height="26" style={{color: 'rgba(238,74,38,.6)'}}/><rect x="620" y="246" width="96" height="26"/>
                <text x="26" y="264">{t('home.trackIntelligence.intro')}</text><text x="144" y="264">{t('home.trackIntelligence.build')}</text><text x="300" y="264">{t('home.trackIntelligence.breakdown')}</text><text x="428" y="264" style={{fill: '#fff'}}>{t('home.trackIntelligence.drop')}</text><text x="630" y="264">{t('home.trackIntelligence.outro')}</text>
              </g>
              {/* timbre strip */}
              <defs>
                <linearGradient id="hm-tgrad" x1="0" x2="1">
                  <stop offset="0" stopColor="#3d2a22"/><stop offset=".35" stopColor="#7a3a1c"/><stop offset=".62" stopColor="#c04a20"/><stop offset=".8" stopColor="#6e4a3a"/><stop offset="1" stopColor="#2c2c34"/>
                </linearGradient>
              </defs>
              <rect x="16" y="292" width="700" height="16" style={{color: 'rgba(255,255,255,.14)'}}/>
              <rect className="hm-f" x="16" y="292" width="700" height="16" fill="url(#hm-tgrad)" opacity=".55"/>
            </svg>
              <svg className="hm-sl hm-ti-mob" viewBox="0 0 393 250" aria-hidden="true">
              {/* Two callouts, two baselines. They used to share y=20: the energy label runs from
                  x=8 and the peaks label is centred on the drop line at x=252, so in Fira Code at
                  14px (~9.2px/char with the 0.06em tracking) they ran into each other around
                  x=164–239 and the white and orange text overprinted.

                  Stacking them fixes it at every width — the SVG scales with its container, so a
                  fixed-coordinate collision like that never resolves itself on a wider phone. The
                  drop line now starts below the second label instead of at y=28. */}
              <text x="8" y="20" fontSize="14" style={{fill: '#d8d8d8'}}>{t('home.trackIntelligence.calloutEnergy')}</text>
              <text x="252" y="42" fontSize="14" style={{fill: '#EE4A26'}} textAnchor="middle">{t('home.trackIntelligence.calloutPeaks')}</text>
              <line x1="252" y1="50" x2="252" y2="196" style={{color: 'rgba(238,74,38,.4)'}}/>
              <g style={{color: '#EE4A26'}}>
                <polyline points="8,140 52,132 86,112 124,108 152,120 190,116 218,112 252,78 306,76 348,88 385,108" style={{strokeWidth: 2.2}}/>
              </g>
              <circle cx="252" cy="78" r="5" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <circle cx="252" cy="78" r="10" style={{color: 'rgba(238,74,38,.35)'}}/>
              <g fontSize="12" style={{color: 'rgba(255,255,255,.28)'}}>
                <rect x="8" y="156" width="56" height="24"/><rect x="70" y="156" width="76" height="24"/><rect x="152" y="156" width="62" height="24"/><rect x="220" y="156" width="98" height="24" style={{color: 'rgba(238,74,38,.6)'}}/><rect x="324" y="156" width="61" height="24"/>
                <text x="16" y="172">{t('home.trackIntelligence.intro')}</text><text x="78" y="172">{t('home.trackIntelligence.build')}</text><text x="160" y="172">{t('home.trackIntelligence.break')}</text><text x="228" y="172" style={{fill: '#fff'}}>{t('home.trackIntelligence.drop')}</text><text x="332" y="172">{t('home.trackIntelligence.outro')}</text>
              </g>
              <defs>
                <linearGradient id="hm-tgradm" x1="0" x2="1">
                  <stop offset="0" stopColor="#3d2a22"/><stop offset=".35" stopColor="#7a3a1c"/><stop offset=".62" stopColor="#c04a20"/><stop offset=".8" stopColor="#6e4a3a"/><stop offset="1" stopColor="#2c2c34"/>
                </linearGradient>
              </defs>
              <rect x="8" y="196" width="377" height="14" style={{color: 'rgba(255,255,255,.14)'}}/>
              <rect className="hm-f" x="8" y="196" width="377" height="14" fill="url(#hm-tgradm)" opacity=".55"/>
              <text x="8" y="236" fontSize="13" style={{fill: '#d8d8d8'}}>{t('home.trackIntelligence.calloutTimbre')}</text>
            </svg>
            </div>
            <aside className="hm-ti-metrics">
              <div className="hm-mgrid">
                <div>
                  <span className="hm-mk">{t('home.trackIntelligence.mkKey')}</span>
                  <span className="hm-mv">{SAMPLE_KEY}</span>
                </div>
                <div>
                  <span className="hm-mk">{t('home.trackIntelligence.mkTempo')}</span>
                  <span className="hm-mv">{SAMPLE_BPM}</span>
                </div>
                <div>
                  <span className="hm-mk">{t('home.trackIntelligence.mkLoudness')}</span>
                  <span className="hm-mv2">{SAMPLE_LUFS}</span>
                </div>
                <div>
                  <span className="hm-mk">{t('home.trackIntelligence.mkStyle')}</span>
                  <span className="hm-mv2">{SAMPLE_STYLE}</span>
                </div>
              </div>
              <div className="hm-mread">{t('home.trackIntelligence.reading')}</div>
            </aside>
          </div>
          <figcaption className="hm-ti-cap">
            <span>{t('home.trackIntelligence.capOne')}</span>
            <span>{t('home.trackIntelligence.capConf')}</span>
          </figcaption>
        </figure>
        <div className="hm-ti-after">
          <button type="button" className="hm-tlink" onClick={() => navigate('/product/track-intelligence')}>
            {t('home.trackIntelligence.exploreLink')}
          </button>
        </div>
      </div>
    </section>
  );
}
