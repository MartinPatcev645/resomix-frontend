import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { BASE_BETA_URL } from '@resomix/config';

export function DjHero() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  return (
    <section className="dj-hero dj-section" id="dj-hero">
      <div className="dj-frame">
        <p className="dj-beta">
          <i aria-hidden="true" />
          {t('djs.hero.chip')}
        </p>
        <h1 className="dj-benzin uppercase">
          <span>{t('djs.hero.h1a')}</span>
          <br />
          <span className="dj-l3">{t('djs.hero.h1b')}</span>
        </h1>
        <p className="dj-intro">{t('djs.hero.intro')}</p>
        <div className="dj-ctas">
          <a className="dj-cta-p uppercase" href={BASE_BETA_URL}>
            {t('djs.cta.try')}
          </a>
          <button
            type="button"
            className="dj-cta-s uppercase"
            onClick={() => navigate('/product/sonic-discovery')}
          >
            {t('djs.cta.exploreSd')}
          </button>
          <span className="dj-lbl-dim">{t('djs.hero.ctaNote')}</span>
        </div>
      </div>

      <div
        className="dj-hero-art"
        role="img"
        aria-label={t('djs.hero.figureAria')}
      >
        <div className="dj-hero-glow" aria-hidden="true" />
        {/* Desktop: preview geometry; viewBox width-tight so art scales large by design. */}
        <svg className="dj-sl dj-hero-d" viewBox="0 0 1240 300" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.13)' }}>
            <rect x="44" y="96" width="524" height="46" />
            <rect x="44" y="160" width="524" height="46" />
            <rect x="44" y="224" width="524" height="46" />
          </g>
          <g style={{ color: 'rgba(255,255,255,.3)' }}>
            <path d="M56 104 V138 M64 106 V138 M72 103 V138 M80 107 V138 M88 104 V138 M96 106 V138 M104 103 V138 M112 105 V138 M120 104 V138 M128 107 V138 M136 103 V138 M144 106 V138 M152 104 V138 M160 105 V138 M168 103 V138 M176 107 V138 M184 104 V138 M192 106 V138 M200 103 V138 M208 105 V138 M216 107 V138 M224 104 V138 M232 106 V138 M248 103 V138 M256 105 V138 M264 104 V138 M272 107 V138 M280 103 V138 M288 106 V138 M296 104 V138 M304 105 V138 M312 107 V138 M320 103 V138 M328 106 V138 M336 104 V138 M344 105 V138 M352 103 V138 M360 107 V138 M368 104 V138 M376 106 V138 M384 103 V138 M392 105 V138 M400 104 V138 M408 107 V138 M416 103 V138 M424 106 V138 M432 104 V138 M440 105 V138 M448 107 V138 M456 103 V138 M464 106 V138 M472 104 V138 M480 105 V138 M488 103 V138 M496 107 V138 M504 104 V138 M512 106 V138 M520 103 V138 M528 105 V138 M536 104 V138 M544 107 V138 M552 106 V138" />
          </g>
          <line
            x1="240"
            y1="100"
            x2="240"
            y2="138"
            strokeDasharray="2 4"
            style={{ color: 'rgba(238,74,38,.35)' }}
          />
          <g style={{ color: 'rgba(255,255,255,.28)' }}>
            <path d="M56 168 V202 M64 170 V202 M72 167 V202 M80 171 V202 M88 168 V202 M96 170 V202 M104 167 V202 M112 169 V202 M120 168 V202 M128 171 V202 M136 167 V202 M144 170 V202 M152 168 V202 M160 169 V202 M168 167 V202 M176 171 V202 M184 168 V202 M192 170 V202 M200 167 V202 M208 169 V202 M216 171 V202 M224 168 V202 M232 170 V202 M240 167 V202 M248 169 V202 M256 168 V202 M264 171 V202 M272 167 V202 M280 170 V202 M288 168 V202 M296 169 V202 M304 171 V202 M312 167 V202 M320 170 V202 M328 168 V202 M336 169 V202 M344 167 V202 M352 171 V202 M360 168 V202 M368 170 V202 M376 167 V202 M384 169 V202 M392 168 V202 M400 171 V202 M408 167 V202 M416 170 V202 M424 168 V202 M432 169 V202 M440 171 V202 M448 167 V202 M456 170 V202 M464 168 V202 M472 169 V202 M480 167 V202 M488 171 V202 M496 168 V202 M504 170 V202 M512 167 V202 M520 169 V202 M528 168 V202 M536 171 V202 M544 167 V202 M552 170 V202" />
          </g>
          <g style={{ color: 'rgba(255,255,255,.2)' }}>
            <path d="M56 232 V266 M64 234 V266 M72 231 V266 M80 235 V266 M88 232 V266 M96 234 V266 M104 231 V266 M112 233 V266 M120 232 V266 M128 235 V266 M136 231 V266 M144 234 V266 M152 232 V266 M160 233 V266 M168 231 V266 M176 235 V266 M184 232 V266 M192 234 V266 M200 231 V266 M208 233 V266 M216 235 V266 M224 232 V266 M232 234 V266 M240 231 V266 M248 233 V266 M256 232 V266 M264 235 V266 M272 231 V266 M280 234 V266 M288 232 V266 M296 233 V266 M304 235 V266 M312 231 V266 M320 234 V266 M328 232 V266 M336 233 V266 M344 231 V266 M352 235 V266 M360 232 V266 M368 234 V266 M376 231 V266 M384 233 V266 M392 232 V266 M400 235 V266 M408 231 V266 M416 234 V266 M424 232 V266 M432 233 V266 M440 235 V266 M448 231 V266 M456 234 V266 M464 232 V266 M472 233 V266 M480 231 V266 M488 235 V266 M496 232 V266 M504 234 V266 M512 231 V266 M520 233 V266 M528 232 V266 M536 235 V266 M544 231 V266 M552 234 V266" />
          </g>
          <line
            x1="240"
            y1="96"
            x2="252"
            y2="78"
            style={{ color: 'rgba(238,74,38,.4)' }}
            strokeDasharray="2 4"
          />
          <rect
            x="180"
            y="26"
            width="144"
            height="52"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
          />
          <g style={{ color: 'rgba(255,255,255,.7)' }}>
            <path
              d="M190 52 l6-7 5 11 6-15 6 18 5-12 6 7 5-4 6 5 6-9 5 7 6-4 5 3 6-7 6 8 5-3 6 4 5-8 6 6 5-3"
              style={{ strokeWidth: 1.2 }}
            />
          </g>
          <circle
            className="dj-pulse"
            cx="188"
            cy="18"
            r="3.5"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text x="200" y="22" style={{ fontSize: '11px', fill: '#d8d8d8' }}>
            {t('djs.figures.wholeTrack')}
          </text>
          <path
            className="dj-dashflow"
            d="M324 52 C 460 30 560 44 660 88"
            style={{ color: 'rgba(238,74,38,.65)', strokeWidth: 1.8 }}
          />
          <g style={{ color: 'rgba(238,74,38,.75)' }}>
            <path
              d="M660 88 C 740 116 800 152 880 160 C 968 168 1044 132 1120 120"
              style={{ strokeWidth: 2 }}
            />
          </g>
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            <path d="M660 88 C 748 100 820 122 898 124 C 976 126 1044 106 1120 98" />
            <path d="M660 88 C 740 134 820 184 898 192 C 976 200 1052 180 1120 170" />
          </g>
          <circle cx="660" cy="88" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <g style={{ color: 'rgba(238,74,38,.85)' }}>
            <circle cx="798" cy="144" r="6.5" style={{ strokeWidth: 1.6 }} />
            <circle cx="948" cy="160" r="6.5" style={{ strokeWidth: 1.6 }} />
            <circle cx="1120" cy="120" r="6.5" style={{ strokeWidth: 1.6 }} />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="798" y="122" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              01
            </text>
            <text x="948" y="138" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              02
            </text>
            <text x="1120" y="98" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              03
            </text>
          </g>
          <text
            x="890"
            y="236"
            textAnchor="middle"
            style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
          >
            {t('djs.figures.rankedIdeas')}
          </text>
        </svg>

        <svg className="dj-sl dj-hero-m" viewBox="0 0 393 340" aria-hidden="true">
          <g style={{ color: 'rgba(255,255,255,.13)' }}>
            <rect x="20" y="88" width="353" height="40" />
            <rect x="20" y="140" width="353" height="40" />
          </g>
          <g style={{ color: 'rgba(255,255,255,.3)' }}>
            <path d="M28 95 V124 M36 97 V124 M44 94 V124 M52 98 V124 M60 95 V124 M68 97 V124 M76 94 V124 M84 96 V124 M100 95 V124 M108 98 V124 M116 94 V124 M124 97 V124 M132 95 V124 M140 96 V124 M148 94 V124 M156 98 V124 M164 95 V124 M172 97 V124 M180 94 V124 M188 96 V124 M196 98 V124 M204 95 V124 M212 97 V124 M220 94 V124 M228 96 V124 M236 95 V124 M244 98 V124 M252 94 V124 M260 97 V124 M268 95 V124 M276 96 V124 M284 98 V124 M292 94 V124 M300 97 V124 M308 95 V124 M316 96 V124 M324 94 V124 M332 98 V124 M340 95 V124 M348 97 V124 M356 96 V124 M364 94 V124" />
          </g>
          <line
            x1="92"
            y1="92"
            x2="92"
            y2="124"
            strokeDasharray="2 4"
            style={{ color: 'rgba(238,74,38,.35)' }}
          />
          <g style={{ color: 'rgba(255,255,255,.2)' }}>
            <path d="M28 147 V176 M36 149 V176 M44 146 V176 M52 150 V176 M60 147 V176 M68 149 V176 M76 146 V176 M84 148 V176 M92 147 V176 M100 150 V176 M108 146 V176 M116 149 V176 M124 147 V176 M132 148 V176 M140 146 V176 M148 150 V176 M156 147 V176 M164 149 V176 M172 146 V176 M180 148 V176 M188 150 V176 M196 147 V176 M204 149 V176 M212 146 V176 M220 148 V176 M228 147 V176 M236 150 V176 M244 146 V176 M252 149 V176 M260 147 V176 M268 148 V176 M276 146 V176 M284 150 V176 M292 147 V176 M300 149 V176 M308 146 V176 M316 148 V176 M324 150 V176 M332 147 V176 M340 149 V176 M348 146 V176 M356 148 V176 M364 147 V176" />
          </g>
          <line
            x1="92"
            y1="88"
            x2="80"
            y2="70"
            strokeDasharray="2 4"
            style={{ color: 'rgba(238,74,38,.4)' }}
          />
          <rect
            x="30"
            y="22"
            width="110"
            height="44"
            style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.5 }}
          />
          <g style={{ color: 'rgba(255,255,255,.7)' }}>
            <path
              d="M38 44 l5-6 4 9 5-12 5 14 4-10 5 6 4-3 5 4 4-7 5 6 4-3 5 3 4-6 5 6 4-2"
              style={{ strokeWidth: 1.1 }}
            />
          </g>
          <circle
            className="dj-pulse"
            cx="36"
            cy="14"
            r="3"
            style={{ fill: '#EE4A26', stroke: 'none' }}
          />
          <text x="46" y="18" style={{ fontSize: '10.5px', fill: '#d8d8d8' }}>
            {t('djs.figures.wholeTrackShort')}
          </text>
          <path
            className="dj-dashflow"
            d="M140 44 C 220 34 280 50 330 78"
            style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.5 }}
          />
          <g style={{ color: 'rgba(238,74,38,.75)' }}>
            <path
              d="M60 232 C 130 212 200 256 270 252 C 310 250 340 234 366 226"
              style={{ strokeWidth: 2 }}
            />
          </g>
          <g style={{ color: 'rgba(255,255,255,.18)' }}>
            <path d="M60 252 C 140 240 220 276 300 268 C 330 265 350 256 366 250" />
          </g>
          <circle cx="60" cy="232" r="3.5" style={{ fill: '#EE4A26', stroke: 'none' }} />
          <g style={{ color: 'rgba(238,74,38,.85)' }}>
            <circle cx="180" cy="238" r="6" style={{ strokeWidth: 1.5 }} />
            <circle cx="290" cy="250" r="6" style={{ strokeWidth: 1.5 }} />
          </g>
          <g style={{ fill: '#9c9c9c' }}>
            <text x="180" y="218" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              01
            </text>
            <text x="290" y="230" textAnchor="middle" style={{ fontSize: '10.5px' }}>
              02
            </text>
          </g>
          <text
            x="196"
            y="318"
            textAnchor="middle"
            style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
          >
            {t('djs.figures.rankedIdeas')}
          </text>
        </svg>
      </div>

      <div className="dj-frame">
        <div className="dj-hero-caps" aria-hidden="true">
          <span>{t('djs.figures.yourCrate')}</span>
          <span />
          <span>{t('djs.figures.musicIsQuery')}</span>
        </div>
      </div>
    </section>
  );
}
