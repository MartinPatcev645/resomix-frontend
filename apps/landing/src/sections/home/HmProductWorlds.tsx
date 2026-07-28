import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function HmProductWorlds() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="hm-section" id="hm-products">
      <div className="hm-frame">
        <p className="hm-eyebrow uppercase">{t('home.products.eyebrow')}</p>
        <h2 className="hm-h2b uppercase">{t('home.products.head')}</h2>
        <div className="hm-prods">
          <article className="hm-prod">
            <div className="hm-wbar" aria-hidden="true">
              <span className="hm-wt">{t('home.products.sonic.name')}</span>
            </div>
            <div className="hm-world" aria-hidden="true">
              <svg className="hm-sl" viewBox="0 0 360 168">
              <g style={{color: 'rgba(255,255,255,.55)'}}><path d="M16 88 l8-8 6 14 8-20 8 24 7-16 6 8"/></g>
              <circle className="hm-pulse-el" cx="76" cy="88" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <text x="16" y="118" fontSize="11">{t('home.products.reference')}</text>
              <g style={{color: 'rgba(255,255,255,.22)'}}>
                <path d="M76 88 C 120 88 130 46 176 44"/>
                <path d="M76 88 C 122 88 132 88 176 86"/>
                <path d="M76 88 C 120 88 130 130 176 128"/>
              </g>
              <rect x="176" y="32" width="168" height="24" style={{color: 'rgba(238,74,38,.75)'}}/>
              <text x="188" y="48" fontSize="12" style={{fill: '#fff'}}>01 · 98.1%</text>
              <g style={{color: 'rgba(255,255,255,.3)'}}>
                <rect x="176" y="74" width="148" height="24"/>
                <rect x="176" y="116" width="128" height="24"/>
              </g>
              <text x="188" y="90" fontSize="11">02 · 97.4%</text>
              <text x="188" y="132" fontSize="11">03 · 96.8%</text>
            </svg>
            </div>
            <div className="hm-ptxt">
              <h3 className="hm-h3b uppercase">{t('home.products.sonic.name')}</h3>
              <p className="hm-out">{t('home.products.sonic.outcome')}</p>
              <p className="hm-pd">{t('home.products.sonic.description')}</p>
              <button type="button" className="hm-tlink" onClick={() => navigate('/product/sonic-discovery')}>
                {t('home.products.sonic.link')}
              </button>
            </div>
          </article>
          <article className="hm-prod">
            <div className="hm-wbar" aria-hidden="true">
              <span className="hm-wt">{t('home.products.track.name')}</span>
            </div>
            <div className="hm-world" aria-hidden="true">
              {/* illustrative / fictional sample values */}
              <svg className="hm-sl" viewBox="0 0 360 168">
              <text x="344" y="24" fontSize="11.5" textAnchor="end" style={{fill: '#d0d0d0'}}>124 BPM · G MIN</text>
              <g style={{color: 'rgba(255,255,255,.28)'}}><path d="M12 44 l9-10 7 16 9-22 8 26 8-18 8 10 9-6 8 8 9-14 8 10 9-6 8 4 9-8 8 10 9-4 8 6 9-10 8 8 9-4 8 2 9-6 8 6 9-2 8 4 9-6 8 4 9-4 8 2 9-4 8 2"/></g>
              <line x1="252" y1="36" x2="252" y2="136" style={{color: 'rgba(238,74,38,.35)'}}/>
              <g style={{color: '#EE4A26'}}><polyline points="12,116 60,108 100,88 150,84 190,100 226,96 252,64 300,60 330,72 348,84" style={{strokeWidth: 1.8}}/></g>
              <circle cx="252" cy="64" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <g fontSize="10.5" style={{color: 'rgba(255,255,255,.3)'}}>
                <rect x="12" y="140" width="58" height="22"/><rect x="76" y="140" width="66" height="22"/><rect x="148" y="140" width="56" height="22"/><rect x="210" y="140" width="82" height="22" style={{color: 'rgba(238,74,38,.55)'}}/><rect x="298" y="140" width="50" height="22"/>
                <text x="20" y="155">{t('home.products.intro')}</text><text x="84" y="155">{t('home.products.build')}</text><text x="156" y="155">{t('home.products.break')}</text><text x="218" y="155">{t('home.products.drop')}</text><text x="306" y="155">{t('home.products.outro')}</text>
              </g>
            </svg>
            </div>
            <div className="hm-ptxt">
              <h3 className="hm-h3b uppercase">{t('home.products.track.name')}</h3>
              <p className="hm-out">{t('home.products.track.outcome')}</p>
              <p className="hm-pd">{t('home.products.track.description')}</p>
              <button type="button" className="hm-tlink" onClick={() => navigate('/product/track-intelligence')}>
                {t('home.products.track.link')}
              </button>
            </div>
          </article>
          <article className="hm-prod">
            <div className="hm-wbar" aria-hidden="true">
              <span className="hm-wt">{t('home.products.catalogue.name')}</span>
            </div>
            <div className="hm-world" aria-hidden="true">
              <svg className="hm-sl" viewBox="0 0 360 168">
              <rect x="10" y="10" width="340" height="148" strokeDasharray="4 5" style={{color: 'rgba(255,255,255,.25)'}}/>
              <text x="20" y="30" fontSize="11">{t('home.products.privateIndex')}</text>
              <text x="240" y="30" fontSize="10.5">{t('home.products.humanReviewed')}</text>
              <g style={{color: 'rgba(255,255,255,.16)'}}>
                <circle cx="74" cy="64" r="2.2"/><circle cx="92" cy="78" r="2.2"/><circle cx="84" cy="96" r="2.2"/><circle cx="106" cy="60" r="2.2"/><circle cx="112" cy="88" r="2.2"/><circle cx="96" cy="112" r="2.2"/><circle cx="124" cy="104" r="2.2"/>
                <circle cx="186" cy="54" r="2.2"/><circle cx="204" cy="66" r="2.2"/><circle cx="194" cy="84" r="2.2"/><circle cx="216" cy="52" r="2.2"/><circle cx="224" cy="76" r="2.2"/>
                <circle cx="280" cy="102" r="2.2"/><circle cx="296" cy="116" r="2.2"/><circle cx="312" cy="98" r="2.2"/><circle cx="288" cy="132" r="2.2"/>
              </g>
              <g style={{color: 'rgba(255,255,255,.06)'}}>
                <path d="M92 78 L186 54 M204 66 L280 102 M112 88 L194 84"/>
              </g>
              <circle cx="34" cy="140" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <text x="24" y="158" fontSize="11">{t('home.products.brief')}</text>
              <g style={{color: 'rgba(238,74,38,.55)'}}>
                <path className="hm-dashflow" d="M34 140 C 60 110 76 84 92 78"/>
                <path className="hm-dashflow" d="M34 140 C 90 120 150 80 194 84"/>
                <path className="hm-dashflow" d="M34 140 C 120 150 220 130 288 132"/>
              </g>
              <g style={{color: 'rgba(238,74,38,.22)'}}>
                <circle cx="92" cy="78" r="11"/><circle cx="194" cy="84" r="11"/><circle cx="288" cy="132" r="11"/>
              </g>
              <g style={{color: 'rgba(238,74,38,.9)'}}>
                <circle cx="92" cy="78" r="7" style={{strokeWidth: 1.8}}/><circle cx="194" cy="84" r="7" style={{strokeWidth: 1.8}}/><circle cx="288" cy="132" r="7" style={{strokeWidth: 1.8}}/>
              </g>
              <circle cx="92" cy="78" r="2.2" style={{fill: '#fff', stroke: 'none'}}/>
              <circle cx="194" cy="84" r="2.2" style={{fill: '#fff', stroke: 'none'}}/>
              <circle className="hm-glowp" cx="288" cy="132" r="3" style={{fill: '#EE4A26', stroke: 'none'}}/>
              <text x="234" y="156" fontSize="11" style={{fill: '#EE4A26'}}>{t('home.products.resurfaced')}</text>
            </svg>
            </div>
            <div className="hm-ptxt">
              <h3 className="hm-h3b uppercase">{t('home.products.catalogue.name')}</h3>
              <p className="hm-out">{t('home.products.catalogue.outcome')}</p>
              <p className="hm-pd">{t('home.products.catalogue.description')}</p>
              <button type="button" className="hm-tlink" onClick={() => navigate('/product/catalog-intelligence')}>
                {t('home.products.catalogue.link')}
              </button>
            </div>
          </article>
        </div>
        <p className="hm-pyx">{t('home.products.footnote')}</p>
      </div>
    </section>
  );
}
