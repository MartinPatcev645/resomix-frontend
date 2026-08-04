import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';
import { HeroTitle } from '@/components/HeroTitle.tsx';

export function PrHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="pr-hero pr-section rx-hero-pad" id="pr-hero">
      <div className="pr-frame">
        <p className="pr-beta">
          <i aria-hidden="true" />
          {t('producers.hero.chip')}
        </p>
        <h1 className="pr-benzin uppercase">
          <HeroTitle text={t('producers.hero.title')} emClass="pr-l2" />
        </h1>
        <p className="pr-intro">{t('producers.hero.support')}</p>
        <div className="pr-ctas">
          <a className="pr-cta-p uppercase" href={BASE_BETA_URL}>
            {t('producers.cta.start')}
          </a>
          <button
            type="button"
            className="pr-cta-s uppercase"
            onClick={() => navigate('/product/track-intelligence')}
          >
            {t('producers.cta.exploreTi')}
          </button>
          <span className="pr-lbl-dim">{t('producers.hero.ctaNote')}</span>
        </div>
      </div>

      <div
        className="pr-hero-art"
        role="img"
        aria-label={t('producers.hero.figureAria')}
      >
        <div className="pr-hero-glow" aria-hidden="true" />
        {/* Desktop: preview geometry; viewBox width-tight so art scales large by design. */}
        <svg className="pr-sl pr-hero-d" viewBox="0 0 1240 300" aria-hidden="true">
          <path
            d="M 232 128 A 62 62 0 1 0 232 168"
            strokeDasharray="4 6"
            style={{ color: 'rgba(255,255,255,.35)', strokeWidth: 1.4 }}
          />
          <circle cx="122" cy="90" r="3" style={{ fill: 'rgba(255,255,255,.4)', stroke: 'none' }} />
          <text
            x="172"
            y="248"
            textAnchor="middle"
            style={{ fontSize: '12px', fill: '#ababab' }}
          >
            {t('producers.figures.creativeLoop')}
          </text>
          <path
            className="pr-dashflow"
            d="M236 148 C 300 148 340 148 384 148"
            style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.6 }}
          />
          <circle
            className="pr-pulse"
            cx="400"
            cy="148"
            r="4.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="400"
            y="116"
            textAnchor="middle"
            style={{ fontSize: '12px', fill: '#e2e2e2' }}
          >
            {t('producers.figures.referenceTrack')}
          </text>
          <path
            d="M408 148 C 480 148 540 148 604 148"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.8 }}
          />
          <circle cx="620" cy="148" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="620" cy="148" r="11" style={{ color: 'rgba(238,74,38,.35)' }} />
          <text
            x="620"
            y="110"
            textAnchor="middle"
            style={{ fontSize: '12px', fill: '#e2e2e2' }}
          >
            {t('producers.figures.pyxisSonicProfile')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.2)' }}>
            <path d="M628 142 C 720 108 790 84 856 68" />
            <path d="M630 145 C 730 128 800 116 872 108" />
            <path d="M630 151 C 730 168 800 180 872 188" />
            <path d="M628 154 C 720 188 790 212 856 228" />
          </g>
          <g style={{ fill: '#ababab' }}>
            <text x="870" y="66" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.rhythm')}
            </text>
            <text x="886" y="108" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.harmony')}
            </text>
            <text x="886" y="196" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.structure')}
            </text>
            <text x="870" y="238" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.energy')}
            </text>
          </g>
          <path
            className="pr-dashflow"
            d="M632 148 C 760 148 900 148 1058 148"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.8 }}
          />
          <text x="800" y="138" style={{ fontSize: '11.5px', fill: '#ababab' }}>
            {t('producers.figures.timbre')}
          </text>
          <circle
            cx="1074"
            cy="148"
            r="6.5"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <circle
            cx="1074"
            cy="148"
            r="11.5"
            style={{ color: 'rgba(255,255,255,.8)', strokeWidth: 1.5 }}
          />
          <circle
            className="pr-glowp"
            cx="1074"
            cy="148"
            r="2.8"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="1074"
            y="110"
            textAnchor="middle"
            style={{ fontSize: '12px', fill: '#e2e2e2' }}
          >
            {t('producers.figures.unexpectedMatch')}
          </text>
          <text
            x="1074"
            y="196"
            textAnchor="middle"
            style={{ fontSize: '11.5px', fill: '#ababab' }}
          >
            {t('producers.figures.newDirections')}
          </text>
        </svg>

        <svg className="pr-sl pr-hero-m" viewBox="0 0 393 408" aria-hidden="true">
          {/* Creative loop, top-left, with a break — spine composition (≤640 only). */}
          <path
            d="M 96 66 A 34 34 0 1 0 96 90"
            strokeDasharray="4 5"
            style={{ color: 'rgba(255,255,255,.35)', strokeWidth: 1.3 }}
          />
          <text x="122" y="66" style={{ fontSize: '11.5px', fill: '#ababab' }}>
            {t('producers.figures.creativeLoop')}
          </text>
          {/* Escape: loop → the spine */}
          <path
            className="pr-dashflow"
            d="M98 80 C 88 102 66 116 48 126"
            style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.4 }}
          />
          {/* The spine at x=44 */}
          <path
            d="M44 134 V 176"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.8 }}
          />
          <circle
            className="pr-pulse"
            cx="44"
            cy="134"
            r="4.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text x="64" y="139" style={{ fontSize: '11.5px', fill: '#e2e2e2' }}>
            {t('producers.figures.referenceTrack')}
          </text>
          <circle cx="44" cy="186" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <circle cx="44" cy="186" r="10.5" style={{ color: 'rgba(238,74,38,.35)' }} />
          <text x="64" y="191" style={{ fontSize: '11.5px', fill: '#e2e2e2' }}>
            {t('producers.figures.pyxisSonicProfile')}
          </text>
          <g style={{ color: 'rgba(255,255,255,.25)' }}>
            <path d="M44 198 V 330" />
            <path d="M44 218 H68 M44 242 H68 M44 266 H68 M44 290 H68 M44 314 H68" />
          </g>
          <g style={{ fill: '#ababab' }}>
            <text x="78" y="222" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.rhythm')}
            </text>
            <text x="78" y="246" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.harmony')}
            </text>
            <text x="78" y="270" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.timbre')}
            </text>
            <text x="78" y="294" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.structure')}
            </text>
            <text x="78" y="318" style={{ fontSize: '11.5px' }}>
              {t('producers.figures.energy')}
            </text>
          </g>
          <path
            className="pr-dashflow"
            d="M44 330 V 352"
            style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.6 }}
          />
          <circle
            cx="44"
            cy="360"
            r="6"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }}
          />
          <circle
            cx="44"
            cy="360"
            r="10.5"
            style={{ color: 'rgba(255,255,255,.8)', strokeWidth: 1.4 }}
          />
          <circle
            className="pr-glowp"
            cx="44"
            cy="360"
            r="2.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text x="64" y="365" style={{ fontSize: '11.5px', fill: '#e2e2e2' }}>
            {t('producers.figures.unexpectedMatch')}
          </text>
          <text x="64" y="396" style={{ fontSize: '11px', fill: '#ababab' }}>
            {t('producers.figures.newDirections')}
          </text>
        </svg>
      </div>
    </section>
  );
}
