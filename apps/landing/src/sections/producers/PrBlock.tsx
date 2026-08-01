import { useTranslation } from 'react-i18next';

export function PrBlock() {
  const { t } = useTranslation('common');

  return (
    <section className="pr-section" id="pr-block">
      <div className="pr-frame">
        <div className="pr-blk-grid">
          <div>
            <p className="pr-eyebrow uppercase">{t('producers.block.eyebrow')}</p>
            <h2 className="pr-h2b uppercase">{t('producers.block.h2')}</h2>
            <p className="pr-body">{t('producers.block.opener')}</p>
            <p className="pr-body">{t('producers.block.engines')}</p>
            <p className="pr-pull">{t('producers.block.pull')}</p>
          </div>

          <figure
            className="pr-fig"
            role="img"
            aria-label={t('producers.block.figureAria')}
          >
            <svg className="pr-sl" viewBox="0 0 560 400" aria-hidden="true">
              <text x="40" y="42" style={{ fontSize: '12px', fill: '#e2e2e2' }}>
                {t('producers.figures.atmosphereAfter')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.3)' }}>
                <rect x="40" y="56" width="480" height="120" />
              </g>
              <g style={{ color: 'rgba(238,74,38,.55)' }}>
                <path
                  d="M56 140 C 120 96 180 92 240 116 C 300 140 380 148 440 120 C 470 106 492 100 504 100"
                  style={{ strokeWidth: 1.6 }}
                />
              </g>
              <g style={{ color: 'rgba(255,255,255,.22)' }}>
                <path d="M56 156 C 130 128 200 124 270 140 C 340 156 420 158 504 132" />
                <path d="M56 120 C 130 92 210 84 290 100 C 370 116 440 116 504 92" />
              </g>
              <g>
                <circle cx="120" cy="110" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
                <circle cx="180" cy="130" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
                <circle cx="260" cy="104" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
                <circle cx="330" cy="136" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
                <circle cx="410" cy="112" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
                <circle cx="470" cy="128" r="1.2" style={{ fill: 'rgba(255,255,255,.14)', stroke: 'none' }} />
              </g>
              <text x="40" y="222" style={{ fontSize: '12px', fill: '#ababab' }}>
                {t('producers.figures.typicalFields')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.28)' }}>
                <rect x="40" y="236" width="220" height="34" />
                <rect x="40" y="282" width="220" height="34" />
                <rect x="40" y="328" width="220" height="34" />
              </g>
              <g style={{ fill: '#6a6a6a' }}>
                <text x="54" y="257" style={{ fontSize: '10px' }}>
                  {t('producers.figures.genre')}
                </text>
                <text x="54" y="303" style={{ fontSize: '10px' }}>
                  {t('producers.figures.artist')}
                </text>
                <text x="54" y="349" style={{ fontSize: '10px' }}>
                  {t('producers.figures.tags')}
                </text>
              </g>
              <g style={{ color: 'rgba(238,74,38,.7)' }}>
                <line x1="122" y1="245" x2="122" y2="261" />
              </g>
              <path
                d="M300 190 C 300 204 300 216 300 228"
                strokeDasharray="2 5"
                style={{ color: 'rgba(255,255,255,.25)' }}
              />
              <text x="316" y="300" style={{ fontSize: '11.5px', fill: '#e2e2e2' }}>
                {t('producers.figures.hardToPut')}
              </text>
            </svg>
            <figcaption>
              <span>{t('producers.figures.youCanFeel')}</span>
              <span>{t('producers.figures.fieldsCantHold')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
