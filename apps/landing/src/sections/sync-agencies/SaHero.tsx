import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HeroTitle } from '@/components/HeroTitle.tsx';

export function SaHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="sa-hero sa-section rx-hero-pad" id="sa-hero">
      <div className="sa-frame">
        <p className="sa-beta">
          <i aria-hidden="true" />
          {t('syncAgencies.hero.chip')}
        </p>
        <h1 className="sa-benzin uppercase"><HeroTitle text={t('syncAgencies.hero.h1')} emClass="sa-em" /></h1>
        <p className="sa-intro">{t('syncAgencies.hero.intro')}</p>
        <div className="sa-ctas">
          <button
            type="button"
            className="sa-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('syncAgencies.cta.pilot')}
          </button>
          <button
            type="button"
            className="sa-cta-s uppercase"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('syncAgencies.cta.exploreCi')}
          </button>
        </div>
      </div>

      {/* Illustrative — fictional tag chips and feel-contour; the four feel-words are Marco's. */}
      <div
        className="sa-hero-art"
        role="img"
        aria-label={t('syncAgencies.hero.figureAria')}
      >
        <div className="sa-hero-glow" aria-hidden="true" />
        {/* Desktop: preview geometry; viewBox width-crops dead margin so art scales ~16% larger. */}
        <svg className="sa-sl sa-hero-d" viewBox="104 40 1240 240" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.28)' }}>
            <rect x="120" y="60" width="118" height="26" />
            <rect x="120" y="98" width="96" height="26" />
            <rect x="120" y="136" width="132" height="26" />
            <rect x="120" y="174" width="88" height="26" />
            <rect x="120" y="212" width="110" height="26" />
          </g>
          <text x="179" y="77" textAnchor="middle" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.tagAmbient')}
          </text>
          <text x="168" y="115" textAnchor="middle" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.tagBpm')}
          </text>
          <text x="186" y="153" textAnchor="middle" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.tagInstrumental')}
          </text>
          <text x="164" y="191" textAnchor="middle" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.tagYear')}
          </text>
          <text x="175" y="229" textAnchor="middle" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.tagElectronic')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <path d="M252 73 C 380 73 430 148 520 150" />
            <path d="M216 111 C 360 111 430 149 520 150" />
            <path d="M252 149 H520" />
            <path d="M208 187 C 360 187 430 151 520 150" />
            <path d="M230 225 C 380 225 430 152 520 150" />
          </g>
          <line x1="552" y1="70" x2="552" y2="230" style={{ color: 'rgba(238,74,38,.6)' }} />
          <line x1="560" y1="70" x2="560" y2="230" style={{ color: 'rgba(238,74,38,.25)' }} />
          <text x="500" y="262" style={{ fontSize: '10.5px' }}>
            {t('syncAgencies.figures.pyxis1')}
          </text>
          <path
            className="sa-dashflow"
            d="M560 150 C 640 150 680 150 740 150"
            style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 2 }}
          />
          <g style={{ color: 'rgba(238,74,38,.75)' }}>
            <path
              d="M740 150 C 800 96 860 84 920 108 C 990 136 1050 190 1120 178 C 1180 168 1230 128 1290 118"
              style={{ strokeWidth: 2 }}
            />
          </g>
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            <path d="M740 150 C 800 130 870 118 930 132 C 1000 148 1060 176 1130 164" />
            <path d="M740 150 C 800 176 870 196 940 186 C 1010 176 1070 148 1140 142" />
          </g>
          <circle className="sa-pulse" cx="740" cy="150" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <g style={{ fill: '#d8d8d8' }}>
            <text x="796" y="74" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelIntimate')}
            </text>
            <text x="988" y="220" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelNostalgic')}
            </text>
            <text x="1112" y="150" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelUnsettling')}
            </text>
            <text x="1252" y="98" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelUplifting')}
            </text>
          </g>
        </svg>

        <svg className="sa-sl sa-hero-m" viewBox="0 0 393 340" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.28)' }}>
            <rect x="24" y="24" width="92" height="24" />
            <rect x="128" y="24" width="80" height="24" />
            <rect x="220" y="24" width="104" height="24" />
          </g>
          <text x="70" y="40" textAnchor="middle" style={{ fontSize: '10px' }}>
            {t('syncAgencies.figures.tagAmbient')}
          </text>
          <text x="168" y="40" textAnchor="middle" style={{ fontSize: '10px' }}>
            {t('syncAgencies.figures.tagBpm')}
          </text>
          <text x="272" y="40" textAnchor="middle" style={{ fontSize: '10px' }}>
            {t('syncAgencies.figures.tagInstrumental')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.16)' }}>
            <path d="M70 48 C 70 70 120 78 180 82" />
            <path d="M168 48 C 168 66 176 74 184 80" />
            <path d="M272 48 C 272 70 240 78 190 82" />
          </g>
          <line x1="130" y1="92" x2="250" y2="92" style={{ color: 'rgba(238,74,38,.6)' }} />
          <line x1="130" y1="100" x2="250" y2="100" style={{ color: 'rgba(238,74,38,.25)' }} />
          <text x="160" y="120" style={{ fontSize: '10px' }}>
            {t('syncAgencies.figures.pyxis1')}
          </text>
          <path
            className="sa-dashflow"
            d="M190 104 V 150"
            style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.8 }}
          />
          <path
            d="M40 214 C 90 170 140 160 190 178 C 245 198 300 240 353 208"
            style={{ color: 'rgba(238,74,38,.75)', strokeWidth: 2 }}
          />
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            <path d="M40 240 C 100 214 160 206 220 218 C 275 228 320 244 353 236" />
          </g>
          <circle className="sa-pulse" cx="190" cy="178" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <g style={{ fill: '#d8d8d8' }}>
            <text x="30" y="188" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelIntimate')}
            </text>
            <text x="128" y="292" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelNostalgic')}
            </text>
            <text x="234" y="160" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelUnsettling')}
            </text>
            <text x="292" y="256" style={{ fontSize: '11px' }}>
              {t('syncAgencies.figures.feelUplifting')}
            </text>
          </g>
        </svg>
      </div>

      <div className="sa-frame">
        <div className="sa-hero-caps" aria-hidden="true">
          <span>{t('syncAgencies.figures.whatTagsSay')}</span>
          <span />
          <span>{t('syncAgencies.figures.howMusicFeels')}</span>
        </div>
      </div>
    </section>
  );
}
