import { useTranslation } from 'react-i18next';

export function DjUnique() {
  const { t } = useTranslation('common');

  return (
    <section className="dj-section" id="dj-unique">
      <div className="dj-frame">
        <div className="dj-uni-grid">
          <div>
            <p className="dj-eyebrow uppercase">{t('djs.unique.eyebrow')}</p>
            <h2 className="dj-h2b uppercase">{t('djs.unique.h2')}</h2>
            <p className="dj-body">{t('djs.unique.p1')}</p>
            <p className="dj-body">{t('djs.unique.p2')}</p>
          </div>

          <figure
            className="dj-fig"
            role="img"
            aria-label={t('djs.unique.figureAria')}
          >
            {/* Illustrative — room arc, white You ring, fan of surfaced ideas. */}
            <svg className="dj-sl" viewBox="0 0 560 380" aria-hidden="true">
              <g style={{ color: 'rgba(255,255,255,.25)' }}>
                <circle cx="150" cy="70" r="2.4" />
                <circle cx="200" cy="52" r="2.4" />
                <circle cx="255" cy="42" r="2.4" />
                <circle cx="310" cy="42" r="2.4" />
                <circle cx="365" cy="52" r="2.4" />
                <circle cx="415" cy="70" r="2.4" />
                <circle cx="176" cy="96" r="2.4" />
                <circle cx="228" cy="80" r="2.4" />
                <circle cx="282" cy="72" r="2.4" />
                <circle cx="336" cy="76" r="2.4" />
                <circle cx="388" cy="92" r="2.4" />
              </g>
              <text x="282" y="24" textAnchor="middle" style={{ fontSize: '10.5px' }}>
                {t('djs.figures.theRoom')}
              </text>
              <circle
                cx="282"
                cy="180"
                r="16"
                style={{ color: 'rgba(255,255,255,.85)', strokeWidth: 1.8 }}
              />
              <text
                x="282"
                y="150"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
              >
                {t('djs.figures.you')}
              </text>
              <path
                d="M282 164 C 282 140 282 122 282 104"
                style={{ color: 'rgba(255,255,255,.2)' }}
                strokeDasharray="2 5"
              />
              <g style={{ color: 'rgba(238,74,38,.5)' }}>
                <path className="dj-dashflow" d="M282 196 C 220 240 170 270 130 300" />
                <path className="dj-dashflow" d="M282 196 C 268 250 260 290 256 322" />
                <path className="dj-dashflow" d="M282 196 C 340 244 390 276 434 302" />
              </g>
              <g style={{ color: 'rgba(238,74,38,.85)' }}>
                <circle cx="122" cy="306" r="7" style={{ strokeWidth: 1.6 }} />
                <circle cx="255" cy="330" r="7" style={{ strokeWidth: 1.6 }} />
                <circle cx="440" cy="306" r="7" style={{ strokeWidth: 1.6 }} />
              </g>
              <circle
                className="dj-glowp"
                cx="255"
                cy="330"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <text x="282" y="368" textAnchor="middle" style={{ fontSize: '10.5px' }}>
                {t('djs.figures.surfacedIdeas')}
              </text>
            </svg>
            <figcaption>
              <span>{t('djs.figures.engineSuggests')}</span>
              <span>{t('djs.figures.youReadRoom')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
