import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function HmHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="hm-hero hm-section" id="hm-hero">
      <div className="hm-frame">
        <p className="hm-beta">
          <i aria-hidden="true" />
          {t('home.hero.beta')}
        </p>
        <h1 className="hm-benzin uppercase">{t('home.hero.title')}</h1>
        <p className="hm-plat">{t('home.hero.platform')}</p>
        <div className="hm-ctas">
          <a className="hm-cta-p" href={BASE_BETA_URL}>
            {t('home.hero.tryCta')}
          </a>
          <button type="button" className="hm-cta-s" onClick={() => navigate('/product')}>
            {t('home.hero.exploreCta')}
          </button>
          <button
            type="button"
            className="hm-tlink"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => navigate('/partners/pilot')}
          >
            {t('home.hero.pilotLink')}
          </button>
        </div>
      </div>

      <div className="hm-hero-art" role="img" aria-label={t('home.hero.figureAria')}>
        <div className="hm-hero-glow" aria-hidden="true" />
        <svg className="hm-sl hm-hero-d" viewBox="0 0 1440 336" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {/* entering reference */}
        <text x="140" y="156" fontSize="12">{t('home.hero.refIn')}</text>
        <g style={{color: 'rgba(255,255,255,.62)'}}>
          <path d="M140 200 l14-10 10 18 12-26 12 32 10-24 10 12 9-6 8 8 H330" style={{strokeWidth: 1.5}}/>
        </g>
        <circle className="hm-pulse-el" cx="336" cy="200" r="4" style={{fill: '#EE4A26', stroke: 'none'}}/>
        {/* five dimension ribbons (quiet) */}
        <g style={{color: 'rgba(255,255,255,.15)'}}>
          <path d="M336 200 C 470 200 500 64 616 64 C 762 64 858 142 952 197" style={{color: 'rgba(255,255,255,.2)'}}/>
          <path d="M336 200 C 470 200 504 132 616 132 C 754 132 858 170 952 199"/>
          <path d="M336 200 C 470 200 504 268 616 268 C 754 268 858 230 952 201"/>
          <path d="M336 200 C 470 200 500 336 616 336 C 762 336 858 258 952 203" style={{color: 'rgba(255,255,255,.2)'}}/>
        </g>
        {/* ribbon labels */}
        <g fontSize="11.5">
          <text x="576" y="54">{t('home.hero.dimWaveform')}</text>
          <text x="576" y="122">{t('home.hero.dimStructure')}</text>
          <text x="576" y="190">{t('home.hero.dimEnergy')}</text>
          <text x="576" y="258">{t('home.hero.dimHarmony')}</text>
          <text x="576" y="326">{t('home.hero.dimTimbre')}</text>
        </g>
        {/* the dominant orange journey */}
        <path d="M336 200 H947" style={{color: 'rgba(238,74,38,.85)', strokeWidth: 2}}/>
        {/* the profile junction */}
        <circle cx="952" cy="200" r="5" style={{fill: '#EE4A26', stroke: 'none'}}/>
        <circle cx="952" cy="200" r="11" style={{color: 'rgba(238,74,38,.35)'}}/>
        <text x="952" y="236" fontSize="11.5" textAnchor="middle">{t('home.hero.pyxisProfile')}</text>
        {/* three branches */}
        <g style={{color: 'rgba(238,74,38,.7)'}}>
          <path className="hm-dashflow" d="M952 200 C 1030 200 1050 112 1126 112" style={{strokeWidth: 1.6}}/>
          <path className="hm-dashflow" d="M952 200 H1126" style={{strokeWidth: 1.6}}/>
          <path className="hm-dashflow" d="M952 200 C 1030 200 1050 288 1126 288" style={{strokeWidth: 1.6}}/>
        </g>
        <g>
          <circle cx="1130" cy="112" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <circle cx="1130" cy="200" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <circle cx="1130" cy="288" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
        </g>
        {/* destinations: the three products, named */}
        <g>
          <text className="hm-dest" x="1150" y="117" fontSize="15">{t('home.hero.destSd')}</text>
          <text x="1150" y="137" fontSize="11">{t('home.hero.destSdSub')}</text>
          <text className="hm-dest" x="1150" y="205" fontSize="15">{t('home.hero.destTi')}</text>
          <text x="1150" y="225" fontSize="11">{t('home.hero.destTiSub')}</text>
          <text className="hm-dest" x="1150" y="293" fontSize="15">{t('home.hero.destCi')}</text>
          <text x="1150" y="313" fontSize="11">{t('home.hero.destCiSub')}</text>
        </g>
        {/* depth field */}
        <g style={{color: 'rgba(255,255,255,.05)'}}>
          <line x1="0" y1="330" x2="1440" y2="330"/>
        </g>
      </svg>
        <svg className="hm-sl hm-hero-m" viewBox="0 0 393 452" aria-hidden="true">
        <text x="40" y="26" fontSize="11">{t('home.hero.refIn')}</text>
        <g style={{color: 'rgba(255,255,255,.62)'}}>
          <path d="M40 48 l10-8 8 14 9-20 9 24 8-16 8 8 7-4 8 6 H340" style={{strokeWidth: 1.4}}/>
        </g>
        <circle className="hm-pulse-el" cx="40" cy="48" r="3.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
        <path d="M40 48 V236" style={{color: 'rgba(238,74,38,.85)', strokeWidth: 2}}/>
        {/* five dimensions */}
        <g style={{color: 'rgba(255,255,255,.25)'}}>
          <path d="M40 104 H72"/><path d="M40 128 H72"/><path d="M40 152 H72"/><path d="M40 176 H72"/><path d="M40 200 H72"/>
        </g>
        <g fontSize="12">
          <text x="82" y="108">{t('home.hero.dimWaveform')}</text>
          <text x="82" y="132">{t('home.hero.dimStructure')}</text>
          <text x="82" y="156">{t('home.hero.dimEnergy')}</text>
          <text x="82" y="180">{t('home.hero.dimHarmony')}</text>
          <text x="82" y="204">{t('home.hero.dimTimbre')}</text>
        </g>
        {/* profile junction */}
        <circle cx="40" cy="240" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
        <circle cx="40" cy="240" r="10" style={{color: 'rgba(238,74,38,.35)'}}/>
        <text x="60" y="244" fontSize="12">{t('home.hero.pyxisProfile')}</text>
        {/* three destinations */}
        <path className="hm-dashflow" d="M40 250 V430" style={{color: 'rgba(238,74,38,.7)', strokeWidth: 1.6}}/>
        <g>
          <circle cx="40" cy="292" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <circle cx="40" cy="360" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
          <circle cx="40" cy="428" r="4.5" style={{fill: '#EE4A26', stroke: 'none'}}/>
        </g>
        <g>
          <text className="hm-dest" x="60" y="290" fontSize="14">{t('home.hero.destSd')}</text>
          <text x="60" y="308" fontSize="11.5">{t('home.hero.destSdSub')}</text>
          <text className="hm-dest" x="60" y="358" fontSize="14">{t('home.hero.destTi')}</text>
          <text x="60" y="376" fontSize="11.5">{t('home.hero.destTiSub')}</text>
          <text className="hm-dest" x="60" y="426" fontSize="14">{t('home.hero.destCi')}</text>
          <text x="60" y="444" fontSize="11.5">{t('home.hero.destCiSub')}</text>
        </g>
      </svg>
      </div>
    </section>
  );
}
