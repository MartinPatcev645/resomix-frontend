import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';
import { HeroTitle } from '@/components/HeroTitle.tsx';

export function McuHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="mcu-hero mcu-section rx-hero-pad" id="mcu-hero">
      <div className="mcu-frame">
        <p className="mcu-beta">
          <i aria-hidden="true" />
          {t('musicCurators.hero.chip')}
        </p>
        <h1 className="mcu-benzin uppercase">
          <HeroTitle text={t('musicCurators.hero.title')} emClass="mcu-l3" />
        </h1>
        <p className="mcu-intro">{t('musicCurators.hero.intro')}</p>
        <div className="mcu-ctas">
          <a className="mcu-cta-p uppercase" href={BASE_BETA_URL}>
            {t('musicCurators.cta.try')}
          </a>
          <button
            type="button"
            className="mcu-cta-s uppercase"
            onClick={() => navigate('/product/sonic-discovery')}
          >
            {t('musicCurators.cta.exploreSd')}
          </button>
          <span className="mcu-lbl-dim">{t('musicCurators.hero.ctaNote')}</span>
        </div>
      </div>

      <div
        className="mcu-hero-art"
        role="img"
        aria-label={t('musicCurators.hero.figureAria')}
      >
        <div className="mcu-hero-glow" aria-hidden="true" />
        {/* Desktop: preview geometry; viewBox width-tight so art scales large by design. */}
        <svg className="mcu-sl mcu-hero-d" viewBox="0 0 1240 300" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.07)' }}>
            <line x1="60" y1="70" x2="1180" y2="70" />
            <line x1="60" y1="130" x2="1180" y2="130" />
            <line x1="60" y1="190" x2="1180" y2="190" />
          </g>
          <g style={{ fill: '#6a6a6a' }}>
            <text x="64" y="60" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.ambient')}
            </text>
            <text x="64" y="120" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.house')}
            </text>
            <text x="64" y="180" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.jazz')}
            </text>
            <text x="64" y="240" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.techno')}
            </text>
          </g>
          <line
            x1="60"
            y1="252"
            x2="1180"
            y2="252"
            style={{ color: 'rgba(255,255,255,.14)' }}
          />
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            <line x1="140" y1="252" x2="140" y2="258" />
            <line x1="400" y1="252" x2="400" y2="258" />
            <line x1="660" y1="252" x2="660" y2="258" />
            <line x1="920" y1="252" x2="920" y2="258" />
            <line x1="1150" y1="252" x2="1150" y2="258" />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="140" y="276" textAnchor="middle" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y1978')}
            </text>
            <text x="400" y="276" textAnchor="middle" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y1992')}
            </text>
            <text x="660" y="276" textAnchor="middle" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y2006')}
            </text>
            <text x="920" y="276" textAnchor="middle" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y2018')}
            </text>
            <text x="1150" y="276" textAnchor="middle" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y2026')}
            </text>
          </g>
          <g>
            <circle cx="150" cy="52" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="310" cy="44" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="560" cy="56" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="820" cy="40" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="1050" cy="52" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="210" cy="104" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="440" cy="96" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="700" cy="110" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="960" cy="98" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="1120" cy="108" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="180" cy="164" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="380" cy="172" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="620" cy="158" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="880" cy="168" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="1080" cy="160" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="260" cy="222" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="500" cy="230" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="760" cy="218" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="1000" cy="226" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
          </g>
          <circle
            className="mcu-pulse"
            cx="920"
            cy="98"
            r="4.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="920"
            y="72"
            textAnchor="middle"
            style={{ fontSize: '11px', fill: '#d8d8d8' }}
          >
            {t('musicCurators.figures.yourReference')}
          </text>
          <defs>
            <linearGradient
              id="mcuJourney"
              gradientUnits="userSpaceOnUse"
              x1="920"
              y1="98"
              x2="620"
              y2="158"
            >
              <stop offset="0" stopColor="#EE4A26" stopOpacity=".3" />
              <stop offset="1" stopColor="#EE4A26" stopOpacity=".85" />
            </linearGradient>
          </defs>
          {/* Inline stroke style — stylesheet currentColor must not override the gradient. */}
          <path
            className="mcu-dashflow"
            d="M920 98 C 812 126 718 150 634 157"
            style={{ stroke: 'url(#mcuJourney)' }}
          />
          <g style={{ color: 'rgba(238,74,38,.55)' }}>
            <path className="mcu-dashflow" d="M614 154 C 500 144 384 108 318 54" />
            <path className="mcu-dashflow" d="M312 52 C 352 122 420 192 490 224" />
          </g>
          <g style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.2 }}>
            <path d="M641 150 L632 157 L641 164" />
            <path d="M330 63 L319 54 L331 47" />
            <path d="M480 215 L491 225 L494 212" />
          </g>
          <path
            d="M934 92 C 992 76 1042 64 1086 56"
            strokeDasharray="3 6"
            style={{ color: 'rgba(238,74,38,.22)' }}
          />
          <g style={{ color: 'rgba(238,74,38,.85)' }}>
            <circle cx="620" cy="158" r="6.5" style={{ strokeWidth: 1.5 }} />
            <circle cx="310" cy="44" r="6.5" style={{ strokeWidth: 1.5 }} />
            <circle cx="500" cy="230" r="6.5" style={{ strokeWidth: 1.5 }} />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="644" y="178" style={{ fontSize: '10px' }}>
              01
            </text>
            <text x="330" y="34" style={{ fontSize: '10px' }}>
              02
            </text>
            <text x="522" y="244" style={{ fontSize: '10px' }}>
              03
            </text>
          </g>
          <circle
            cx="620"
            cy="158"
            r="10.5"
            style={{ color: 'rgba(255,255,255,.8)', strokeWidth: 1.5 }}
          />
          <circle
            className="mcu-glowp"
            cx="310"
            cy="44"
            r="2.6"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
        </svg>

        <svg className="mcu-sl mcu-hero-m" viewBox="0 0 393 330" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.07)' }}>
            <line x1="90" y1="30" x2="90" y2="270" />
            <line x1="190" y1="30" x2="190" y2="270" />
            <line x1="290" y1="30" x2="290" y2="270" />
          </g>
          <g style={{ fill: '#6a6a6a' }}>
            <text x="60" y="22" textAnchor="middle" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.ambient')}
            </text>
            <text x="140" y="22" textAnchor="middle" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.house')}
            </text>
            <text x="240" y="22" textAnchor="middle" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.jazz')}
            </text>
            <text x="340" y="22" textAnchor="middle" style={{ fontSize: '9.5px' }}>
              {t('musicCurators.figures.techno')}
            </text>
          </g>
          <line
            x1="30"
            y1="282"
            x2="363"
            y2="282"
            style={{ color: 'rgba(255,255,255,.14)' }}
          />
          <g style={{ fill: '#9c9c9c' }}>
            <text x="40" y="304" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y1978')}
            </text>
            <text x="322" y="304" style={{ fontSize: '10px' }}>
              {t('musicCurators.figures.y2026')}
            </text>
          </g>
          <g>
            <circle cx="60" cy="80" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="140" cy="60" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="240" cy="90" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="340" cy="70" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="70" cy="150" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="150" cy="170" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="250" cy="140" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="330" cy="160" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="60" cy="230" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="160" cy="240" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="260" cy="220" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
            <circle cx="336" cy="238" r="2.2" style={{ fill: 'rgba(255,255,255,.3)', stroke: 'none' }} />
          </g>
          <circle
            className="mcu-pulse"
            cx="250"
            cy="140"
            r="4"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text
            x="250"
            y="120"
            textAnchor="middle"
            style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
          >
            {t('musicCurators.figures.yourReference')}
          </text>
          <defs>
            <linearGradient
              id="mcuJourneyM"
              gradientUnits="userSpaceOnUse"
              x1="242"
              y1="134"
              x2="140"
              y2="60"
            >
              <stop offset="0" stopColor="#EE4A26" stopOpacity=".3" />
              <stop offset="1" stopColor="#EE4A26" stopOpacity=".85" />
            </linearGradient>
          </defs>
          <path
            className="mcu-dashflow"
            d="M242 134 C 210 110 176 84 148 66"
            style={{ stroke: 'url(#mcuJourneyM)' }}
          />
          <g style={{ color: 'rgba(238,74,38,.55)' }}>
            <path className="mcu-dashflow" d="M138 70 C 128 128 138 186 154 230" />
            <path className="mcu-dashflow" d="M170 244 C 224 226 280 196 320 168" />
          </g>
          <g style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.1 }}>
            <path d="M158 62 L147 65 L152 75" />
            <path d="M146 222 L155 232 L160 220" />
            <path d="M312 176 L322 167 L312 160" />
          </g>
          <path
            d="M262 134 C 288 118 308 104 324 92"
            strokeDasharray="3 5"
            style={{ color: 'rgba(238,74,38,.22)' }}
          />
          <g style={{ color: 'rgba(238,74,38,.85)' }}>
            <circle cx="140" cy="60" r="6" style={{ strokeWidth: 1.4 }} />
            <circle cx="160" cy="240" r="6" style={{ strokeWidth: 1.4 }} />
            <circle cx="330" cy="160" r="6" style={{ strokeWidth: 1.4 }} />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="116" y="52" style={{ fontSize: '10px' }}>
              01
            </text>
            <text x="138" y="262" style={{ fontSize: '10px' }}>
              02
            </text>
            <text x="344" y="152" style={{ fontSize: '10px' }}>
              03
            </text>
          </g>
          <circle
            cx="140"
            cy="60"
            r="10"
            style={{ color: 'rgba(255,255,255,.8)', strokeWidth: 1.4 }}
          />
          <circle
            className="mcu-glowp"
            cx="160"
            cy="240"
            r="2.4"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
        </svg>
      </div>

      <div className="mcu-frame">
        <div className="mcu-hero-caps" aria-hidden="true">
          <span>{t('musicCurators.figures.separatedBy')}</span>
          <span />
          <span>{t('musicCurators.figures.linkedFirst')}</span>
        </div>
      </div>
    </section>
  );
}
