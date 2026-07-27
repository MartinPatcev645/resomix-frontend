import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export function HmCatalogue() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="hm-section" id="hm-catalogue">
      <div className="hm-frame hm-cat">
        <div className="hm-cat-grid">
          <div>
            <p className="hm-eyebrow uppercase">{t('home.catalogue.eyebrow')}</p>
            <h2 className="hm-h2b uppercase">{t('home.catalogue.head')}</h2>
            <p className="hm-body hm-cat-body">{t('home.catalogue.body')}</p>
            <ul className="hm-cat-list">
              <li>{t('home.catalogue.item1')}</li>
              <li>{t('home.catalogue.item2')}</li>
              <li>{t('home.catalogue.item3')}</li>
              <li>{t('home.catalogue.item4')}</li>
            </ul>
            <div className="hm-cat-ctas">
              <button type="button" className="hm-cta-s" onClick={() => navigate('/partners/pilot')}>
                {t('home.catalogue.pilotCta')}
              </button>
              <button type="button" className="hm-tlink" onClick={() => navigate('/product/catalog-intelligence')}>
                {t('home.catalogue.exploreLink')}
              </button>
            </div>
          </div>
          <figure className="hm-cat-map" role="img" aria-label={t('home.catalogue.figureAria')}>
            {/* illustrative year 2011 in resurfaced label via locale */}
            <svg className="hm-sl hm-cm-desk" viewBox="0 0 640 424" aria-hidden="true">
            <rect x="20" y="18" width="600" height="390" strokeDasharray="5 6" style={{color: 'rgba(255,255,255,.25)'}}/>
            <text x="32" y="42" fontSize="11.5">{t('home.catalogue.mapTitle')}</text>
            <text x="478" y="42" fontSize="11">{t('home.catalogue.humanReviewed')}</text>
            {/* cluster A (dense) */}
            <g style={{color: 'rgba(255,255,255,.34)'}}>
              <circle cx="130" cy="120" r="2.6"/><circle cx="152" cy="104" r="2.6"/><circle cx="170" cy="128" r="2.6"/><circle cx="144" cy="146" r="2.6"/><circle cx="186" cy="108" r="2.6"/><circle cx="198" cy="136" r="2.6"/><circle cx="164" cy="164" r="2.6"/><circle cx="126" cy="172" r="2.6"/><circle cx="206" cy="162" r="2.6"/><circle cx="184" cy="184" r="2.6"/><circle cx="146" cy="192" r="2.6"/><circle cx="216" cy="118" r="2.6"/>
            </g>
            <g style={{color: 'rgba(255,255,255,.1)'}}><path d="M152 104 L186 108 M170 128 L198 136 M144 146 L164 164 M130 120 L144 146 M186 108 L216 118 M164 164 L184 184"/></g>
            {/* cluster B (mid) */}
            <g style={{color: 'rgba(255,255,255,.3)'}}>
              <circle cx="382" cy="96" r="2.6"/><circle cx="404" cy="110" r="2.6"/><circle cx="392" cy="132" r="2.6"/><circle cx="420" cy="92" r="2.6"/><circle cx="430" cy="120" r="2.6"/><circle cx="410" cy="148" r="2.6"/><circle cx="444" cy="140" r="2.6"/>
            </g>
            <g style={{color: 'rgba(255,255,255,.09)'}}><path d="M382 96 L420 92 M404 110 L430 120 M392 132 L410 148"/></g>
            {/* cluster C (sparse / underexposed) */}
            <g style={{color: 'rgba(255,255,255,.22)'}}>
              <circle cx="500" cy="230" r="2.6"/><circle cx="532" cy="252" r="2.6"/><circle cx="510" cy="278" r="2.6"/><circle cx="548" cy="296" r="2.6"/>
            </g>
            <text x="474" y="324" fontSize="11">{t('home.catalogue.underexposed')}</text>
            {/* scattered field */}
            <g style={{color: 'rgba(255,255,255,.16)'}}>
              <circle cx="286" cy="86" r="2.2"/><circle cx="310" cy="180" r="2.2"/><circle cx="262" cy="220" r="2.2"/><circle cx="352" cy="240" r="2.2"/><circle cx="240" cy="150" r="2.2"/><circle cx="470" cy="180" r="2.2"/><circle cx="540" cy="120" r="2.2"/><circle cx="300" cy="300" r="2.2"/><circle cx="220" cy="270" r="2.2"/><circle cx="430" cy="330" r="2.2"/><circle cx="360" cy="60" r="2.2"/>
            </g>
            {/* the brief enters */}
            <circle cx="82" cy="330" r="4" style={{fill: '#EE4A26', stroke: 'none'}}/>
            <text x="52" y="358" fontSize="12" style={{fill: '#d8d8d8'}}>{t('home.catalogue.refBrief')}</text>
            <g style={{color: 'rgba(238,74,38,.6)'}}>
              <path className="hm-dashflow" d="M82 330 C 120 270 140 190 164 164"/>
              <path className="hm-dashflow" d="M82 330 C 180 300 320 180 392 132"/>
              <path className="hm-dashflow" d="M82 330 C 220 360 420 330 510 278"/>
            </g>
            {/* the surfaced set: halo + weighted ring + bright core */}
            <g style={{color: 'rgba(238,74,38,.22)'}}>
              <circle cx="164" cy="164" r="14"/><circle cx="392" cy="132" r="14"/><circle cx="510" cy="278" r="14"/>
            </g>
            <g style={{color: 'rgba(238,74,38,.9)'}}>
              <circle cx="164" cy="164" r="8" style={{strokeWidth: 1.8}}/><circle cx="392" cy="132" r="8" style={{strokeWidth: 1.8}}/><circle cx="510" cy="278" r="8" style={{strokeWidth: 1.8}}/>
            </g>
            <g>
              <circle cx="164" cy="164" r="2.6" style={{fill: '#fff', stroke: 'none'}}/><circle cx="392" cy="132" r="2.6" style={{fill: '#fff', stroke: 'none'}}/>
            </g>
            <circle className="hm-glowp" cx="510" cy="278" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
            <text x="432" y="258" fontSize="12" style={{fill: '#EE4A26'}}>{t('home.catalogue.resurfaced')}</text>
          </svg>
            <svg className="hm-sl hm-cm-mob" viewBox="0 0 393 330" aria-hidden="true">
            <rect x="10" y="10" width="373" height="286" strokeDasharray="5 6" style={{color: 'rgba(255,255,255,.25)'}}/>
            <text x="22" y="34" fontSize="12.5">{t('home.catalogue.mapTitleShort')}</text>
            <text x="258" y="34" fontSize="12">{t('home.catalogue.humanReviewed')}</text>
            <g style={{color: 'rgba(255,255,255,.34)'}}>
              <circle cx="90" cy="90" r="2.6"/><circle cx="112" cy="76" r="2.6"/><circle cx="126" cy="100" r="2.6"/><circle cx="102" cy="116" r="2.6"/><circle cx="140" cy="82" r="2.6"/><circle cx="146" cy="112" r="2.6"/>
            </g>
            <g style={{color: 'rgba(255,255,255,.3)'}}>
              <circle cx="240" cy="70" r="2.6"/><circle cx="262" cy="84" r="2.6"/><circle cx="250" cy="104" r="2.6"/><circle cx="276" cy="66" r="2.6"/>
            </g>
            <g style={{color: 'rgba(255,255,255,.22)'}}>
              <circle cx="300" cy="180" r="2.6"/><circle cx="330" cy="200" r="2.6"/><circle cx="308" cy="222" r="2.6"/>
            </g>
            <g style={{color: 'rgba(255,255,255,.16)'}}>
              <circle cx="190" cy="130" r="2.2"/><circle cx="170" cy="180" r="2.2"/><circle cx="230" cy="160" r="2.2"/><circle cx="130" cy="170" r="2.2"/>
            </g>
            <circle cx="46" cy="240" r="4" style={{fill: '#EE4A26', stroke: 'none'}}/>
            <text x="26" y="268" fontSize="12.5" style={{fill: '#d8d8d8'}}>{t('home.catalogue.refBrief')}</text>
            <g style={{color: 'rgba(238,74,38,.6)'}}>
              <path className="hm-dashflow" d="M46 240 C 60 190 84 130 102 116"/>
              <path className="hm-dashflow" d="M46 240 C 130 220 200 130 250 104"/>
              <path className="hm-dashflow" d="M46 240 C 140 268 250 250 308 222"/>
            </g>
            <g style={{color: 'rgba(238,74,38,.22)'}}>
              <circle cx="102" cy="116" r="13"/><circle cx="250" cy="104" r="13"/><circle cx="308" cy="222" r="13"/>
            </g>
            <g style={{color: 'rgba(238,74,38,.9)'}}>
              <circle cx="102" cy="116" r="8" style={{strokeWidth: 1.8}}/><circle cx="250" cy="104" r="8" style={{strokeWidth: 1.8}}/><circle cx="308" cy="222" r="8" style={{strokeWidth: 1.8}}/>
            </g>
            <g>
              <circle cx="102" cy="116" r="2.6" style={{fill: '#fff', stroke: 'none'}}/><circle cx="250" cy="104" r="2.6" style={{fill: '#fff', stroke: 'none'}}/>
            </g>
            <circle className="hm-glowp" cx="308" cy="222" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
            <text x="230" y="254" fontSize="12.5" style={{fill: '#EE4A26'}}>{t('home.catalogue.resurfaced')}</text>
          </svg>
            <figcaption className="hm-legend">
              <span className="hm-l1"><i />{t('home.catalogue.legend1')}</span>
              <span className="hm-l2"><i />{t('home.catalogue.legend2')}</span>
              <span className="hm-l3"><i />{t('home.catalogue.legend3')}</span>
              <span className="hm-l4"><i />{t('home.catalogue.legend4')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
