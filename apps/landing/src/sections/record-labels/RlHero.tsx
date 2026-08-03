import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { HeroTitle } from '@/components/HeroTitle.tsx';

/* Illustrative — fictional catalogue (years, bar heights). */
const DESKTOP_BARS: [number, number][] = [
  [150, 176], [176, 190], [205, 163], [238, 196], [271, 182], [304, 200],
  [330, 170], [366, 188], [399, 158], [432, 194], [465, 176], [498, 200],
  [531, 168], [564, 190], [597, 150], [630, 196], [663, 180], [696, 204],
  [729, 164], [762, 192], [795, 172], [828, 198], [861, 156], [894, 186],
  [927, 174], [960, 200], [993, 162], [1026, 190], [1059, 178], [1092, 196],
  [1125, 158], [1158, 188], [1191, 170], [1224, 194], [1257, 180],
];

const MOBILE_BARS: [number, number][] = [
  [44, 178], [62, 190], [80, 168], [98, 194], [116, 150], [134, 186],
  [152, 172], [170, 196], [188, 160], [206, 188], [224, 174], [242, 198],
  [260, 164], [278, 190], [296, 176], [314, 192],
];

const YEAR_TICKS = [140, 260, 380, 500, 620, 740, 860, 980, 1100, 1220, 1320];

export function RlHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="rl-hero rl-section rx-hero-pad" id="rl-hero">
      <div className="rl-frame">
        <p className="rl-beta">
          <i aria-hidden="true" />
          {t('recordLabels.hero.chip')}
        </p>
        <h1 className="rl-benzin uppercase"><HeroTitle text={t('recordLabels.hero.h1')} emClass="rl-em" /></h1>
        <p className="rl-intro">{t('recordLabels.hero.intro')}</p>
        <div className="rl-ctas">
          <button
            type="button"
            className="rl-cta-p uppercase"
            onClick={() => navigate('/partners/pilot')}
          >
            {t('recordLabels.cta.pilot')}
          </button>
          <button
            type="button"
            className="rl-cta-s uppercase"
            onClick={() => navigate('/product/catalog-intelligence')}
          >
            {t('recordLabels.cta.exploreCi')}
          </button>
        </div>
      </div>

      <div
        className="rl-hero-art"
        role="img"
        aria-label={t('recordLabels.hero.figureAria')}
      >
        <div className="rl-hero-glow" aria-hidden="true" />
        <svg className="rl-sl rl-hero-d" viewBox="0 0 1440 300" aria-hidden="true">
          <line x1="96" y1="220" x2="1344" y2="220" style={{ color: 'rgba(255,255,255,.12)' }} />
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            {YEAR_TICKS.map((x) => (
              <line key={x} x1={x} y1="220" x2={x} y2="226" />
            ))}
          </g>
          <text x="132" y="248" fontSize="10.5">
            2016
          </text>
          <text x="1300" y="248" fontSize="10.5">
            2026
          </text>
          <g style={{ color: 'rgba(255,255,255,.3)' }}>
            {DESKTOP_BARS.map(([x, y2]) => (
              <line key={x} x1={x} y1="220" x2={x} y2={y2} />
            ))}
          </g>
          <circle className="rl-pulse" cx="1290" cy="150" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <line x1="1290" y1="220" x2="1290" y2="158" style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.8 }} />
          <text x="1268" y="132" fontSize="11" style={{ fill: '#d8d8d8' }}>
            {t('recordLabels.figures.newSigning')}
          </text>
          <path
            className="rl-dashflow"
            d="M1290 150 C 1080 40 600 40 399 140"
            style={{ color: 'rgba(238,74,38,.65)', strokeWidth: 1.6 }}
          />
          <circle className="rl-glowp" cx="399" cy="150" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="399" cy="150" r="11" style={{ color: 'rgba(238,74,38,.35)' }} />
          <line x1="399" y1="220" x2="399" y2="158" style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.8 }} />
          <text x="368" y="128" fontSize="11" style={{ fill: '#EE4A26' }}>
            {t('recordLabels.figures.relit2019')}
          </text>
        </svg>

        <svg className="rl-sl rl-hero-m" viewBox="0 0 393 260" aria-hidden="true">
          <line x1="30" y1="210" x2="370" y2="210" style={{ color: 'rgba(255,255,255,.12)' }} />
          <text x="30" y="234" fontSize="10">
            2016
          </text>
          <text x="336" y="234" fontSize="10">
            2026
          </text>
          <g style={{ color: 'rgba(255,255,255,.3)' }}>
            {MOBILE_BARS.map(([x, y2]) => (
              <line key={x} x1={x} y1="210" x2={x} y2={y2} />
            ))}
          </g>
          <circle className="rl-pulse" cx="348" cy="150" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <line x1="348" y1="210" x2="348" y2="157" style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.6 }} />
          <path
            className="rl-dashflow"
            d="M348 150 C 280 60 180 60 116 140"
            style={{ color: 'rgba(238,74,38,.65)', strokeWidth: 1.4 }}
          />
          <circle className="rl-glowp" cx="116" cy="146" r="4.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="116" cy="146" r="10" style={{ color: 'rgba(238,74,38,.35)' }} />
          <text x="84" y="126" fontSize="11" style={{ fill: '#EE4A26' }}>
            {t('recordLabels.figures.relit2019')}
          </text>
          <text x="262" y="132" fontSize="11" style={{ fill: '#d8d8d8' }}>
            {t('recordLabels.figures.newSigning')}
          </text>
        </svg>
      </div>

      <div className="rl-frame">
        <div className="rl-hero-caps" aria-hidden="true">
          <span>{t('recordLabels.figures.tenYears')}</span>
          <span />
          <span>{t('recordLabels.figures.oneThread')}</span>
        </div>
      </div>
    </section>
  );
}
