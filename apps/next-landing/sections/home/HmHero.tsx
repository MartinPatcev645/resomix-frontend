import Link from 'next/link'
import { HeroTitle } from '@/components/HeroTitle'
import { t } from '@/lib/i18n'
import { BETA_URL } from '@/lib/site'

export function HmHero() {
  return (
    <section className="hm-hero hm-section rx-hero-pad" id="hm-hero">
      <div className="hm-frame">
        <p className="hm-beta">
          <i aria-hidden="true" />
          {t('home.hero.beta')}
        </p>
        <h1 className="hm-benzin uppercase"><HeroTitle text={t('home.hero.title')} emClass="hm-em" /></h1>
        <p className="hm-plat">{t('home.hero.platform')}</p>
        <div className="hm-ctas">
          <a className="hm-cta-p" href={BETA_URL}>
            {t('home.hero.tryCta')}
          </a>
          <Link className="hm-cta-s" href="/product">
            {t('home.hero.exploreCta')}
          </Link>
          <Link className="hm-tlink" href="/partners/pilot">
            {t('home.hero.pilotLink')}
          </Link>
        </div>
      </div>

      <div className="hm-hero-art" role="img" aria-label={t('home.hero.figureAria')}>
        <div className="hm-hero-glow" aria-hidden="true" />
        <svg className="hm-sl hm-hero-d" viewBox="0 0 1440 348" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {/* entering reference */}
          <text x="140" y="156" fontSize="12">
            {t('home.hero.refIn')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.62)' }}>
            <path
              d="M140 200 l14-10 10 18 12-26 12 32 10-24 10 12 9-6 8 8 H330"
              style={{ strokeWidth: 1.5 }}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <circle className="hm-pulse-el" cx="336" cy="200" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
          {/* five dimension ribbons (quiet context) */}
          <g style={{ color: 'rgba(255,255,255,.12)' }}>
            <path
              d="M336 200 C 470 200 500 64 616 64 C 762 64 858 142 952 197"
              style={{ color: 'rgba(255,255,255,.16)' }}
            />
            <path d="M336 200 C 470 200 504 132 616 132 C 762 132 858 170 952 199" />
            <path d="M336 200 C 470 200 504 268 616 268 C 762 268 858 230 952 201" />
            <path
              d="M336 200 C 470 200 500 336 616 336 C 762 336 858 258 952 203"
              style={{ color: 'rgba(255,255,255,.16)' }}
            />
          </g>
          <g fontSize="12">
            <text x="576" y="54">
              {t('home.hero.dimWaveform')}
            </text>
            <text x="576" y="122">
              {t('home.hero.dimStructure')}
            </text>
            <text x="576" y="190">
              {t('home.hero.dimEnergy')}
            </text>
            <text x="576" y="258">
              {t('home.hero.dimHarmony')}
            </text>
            <text x="576" y="326">
              {t('home.hero.dimTimbre')}
            </text>
          </g>
          {/* dominant orange journey */}
          <path
            d="M336 200 H947"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 2 }}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="952" cy="200" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="952" cy="200" r="11" style={{ color: 'rgba(238,74,38,.35)' }} />
          <text x="952" y="236" fontSize="12" textAnchor="middle">
            {t('home.hero.pyxisProfile')}
          </text>
          <g style={{ color: 'rgba(238,74,38,.75)' }}>
            <path
              className="hm-dashflow"
              d="M952 200 C 1030 200 1050 112 1126 112"
              style={{ strokeWidth: 1.5 }}
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="hm-dashflow"
              d="M952 200 H1126"
              style={{ strokeWidth: 1.5 }}
              vectorEffect="non-scaling-stroke"
            />
            <path
              className="hm-dashflow"
              d="M952 200 C 1030 200 1050 288 1126 288"
              style={{ strokeWidth: 1.5 }}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <g>
            <circle cx="1130" cy="112" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
            <circle cx="1130" cy="200" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
            <circle cx="1130" cy="288" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          </g>
          <g>
            <text className="hm-dest" x="1150" y="117" fontSize="15">
              {t('home.hero.destSd')}
            </text>
            <text x="1150" y="137" fontSize="12">
              {t('home.hero.destSdSub')}
            </text>
            <text className="hm-dest" x="1150" y="205" fontSize="15">
              {t('home.hero.destTi')}
            </text>
            <text x="1150" y="225" fontSize="12">
              {t('home.hero.destTiSub')}
            </text>
            <text className="hm-dest" x="1150" y="293" fontSize="15">
              {t('home.hero.destCi')}
            </text>
            <text x="1150" y="313" fontSize="12">
              {t('home.hero.destCiSub')}
            </text>
          </g>
          <g style={{ color: 'rgba(255,255,255,.05)' }}>
            <line x1="0" y1="340" x2="1440" y2="340" />
          </g>
        </svg>
        <svg className="hm-sl hm-hero-m" viewBox="0 0 393 460" aria-hidden="true">
          <text x="40" y="26" fontSize="12">
            {t('home.hero.refIn')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.62)' }}>
            <path
              d="M40 48 l10-8 8 14 9-20 9 24 8-16 8 8 7-4 8 6 H340"
              style={{ strokeWidth: 1.4 }}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <circle className="hm-pulse-el" cx="40" cy="48" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <path
            d="M40 48 V236"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 2 }}
            vectorEffect="non-scaling-stroke"
          />
          <g style={{ color: 'rgba(255,255,255,.2)' }}>
            <path d="M40 104 H72" />
            <path d="M40 128 H72" />
            <path d="M40 152 H72" />
            <path d="M40 176 H72" />
            <path d="M40 200 H72" />
          </g>
          <g fontSize="12">
            <text x="82" y="108">
              {t('home.hero.dimWaveform')}
            </text>
            <text x="82" y="132">
              {t('home.hero.dimStructure')}
            </text>
            <text x="82" y="156">
              {t('home.hero.dimEnergy')}
            </text>
            <text x="82" y="180">
              {t('home.hero.dimHarmony')}
            </text>
            <text x="82" y="204">
              {t('home.hero.dimTimbre')}
            </text>
          </g>
          <circle cx="40" cy="240" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="40" cy="240" r="10" style={{ color: 'rgba(238,74,38,.35)' }} />
          <text x="60" y="244" fontSize="12">
            {t('home.hero.pyxisProfile')}
          </text>
          <path
            className="hm-dashflow"
            d="M40 250 V430"
            style={{ color: 'rgba(238,74,38,.75)', strokeWidth: 1.5 }}
            vectorEffect="non-scaling-stroke"
          />
          <g>
            <circle cx="40" cy="292" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
            <circle cx="40" cy="360" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
            <circle cx="40" cy="428" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          </g>
          <g>
            <text className="hm-dest" x="60" y="290" fontSize="14">
              {t('home.hero.destSd')}
            </text>
            <text x="60" y="308" fontSize="12">
              {t('home.hero.destSdSub')}
            </text>
            <text className="hm-dest" x="60" y="358" fontSize="14">
              {t('home.hero.destTi')}
            </text>
            <text x="60" y="376" fontSize="12">
              {t('home.hero.destTiSub')}
            </text>
            <text className="hm-dest" x="60" y="426" fontSize="14">
              {t('home.hero.destCi')}
            </text>
            <text x="60" y="444" fontSize="12">
              {t('home.hero.destCiSub')}
            </text>
          </g>
        </svg>
      </div>
    </section>
  );
}
