import { useTranslation } from 'react-i18next';

export function McuPhilosophy() {
  const { t } = useTranslation('common');

  return (
    <section className="mcu-section" id="mcu-philosophy">
      <div className="mcu-frame">
        <div className="mcu-emo-grid">
          <div>
            <p className="mcu-eyebrow uppercase">{t('musicCurators.philosophy.eyebrow')}</p>
            <h2 className="mcu-h2b uppercase">{t('musicCurators.philosophy.h2')}</h2>
            <p className="mcu-body">{t('musicCurators.philosophy.p1')}</p>
            <p className="mcu-body mcu-body-soft">{t('musicCurators.philosophy.p2')}</p>
          </div>

          <figure
            className="mcu-fig"
            role="img"
            aria-label={t('musicCurators.philosophy.figureAria')}
          >
            <svg className="mcu-sl" viewBox="0 0 560 400" aria-hidden="true">
              <g style={{ color: 'rgba(255,255,255,.3)' }}>
                <rect x="60" y="60" width="180" height="88" />
              </g>
              <text x="70" y="48" style={{ fontSize: '10.5px', fill: '#c9c9c9' }}>
                {t('musicCurators.figures.y1983')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.55)' }}>
                <path
                  d="M76 118 C 100 92 124 88 148 100 C 172 112 200 108 224 92"
                  style={{ strokeWidth: 1.5 }}
                />
              </g>
              <g style={{ color: 'rgba(255,255,255,.3)' }}>
                <rect x="320" y="240" width="180" height="88" />
              </g>
              <text x="330" y="228" style={{ fontSize: '10.5px', fill: '#c9c9c9' }}>
                {t('musicCurators.figures.y2025')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.55)' }}>
                <path
                  d="M336 298 C 360 272 384 268 408 280 C 432 292 460 288 484 272"
                  style={{ strokeWidth: 1.5 }}
                />
              </g>
              <g style={{ color: 'rgba(238,74,38,.28)' }}>
                <path
                  d="M206 178 C 230 152 254 148 278 160 C 302 172 330 168 354 152"
                  style={{ strokeWidth: 1.4 }}
                />
              </g>
              <text
                x="280"
                y="136"
                textAnchor="middle"
                style={{ fontSize: '10px', fill: '#EE4A26' }}
              >
                {t('musicCurators.figures.sameEmotionalShape')}
              </text>
              <path
                className="mcu-dashflow"
                d="M150 148 C 190 210 290 260 410 284"
                style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.8 }}
              />
              <circle
                cx="280"
                cy="222"
                r="13"
                style={{ color: 'rgba(255,255,255,.9)', strokeWidth: 2.2 }}
              />
              <circle
                cx="280"
                cy="222"
                r="19"
                style={{ color: 'rgba(255,255,255,.22)' }}
              />
              <text
                x="280"
                y="196"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
              >
                {t('musicCurators.figures.linkedByYou')}
              </text>
              <text
                x="280"
                y="376"
                textAnchor="middle"
                style={{ fontSize: '10.5px' }}
              >
                {t('musicCurators.figures.forTheFirstTime')}
              </text>
            </svg>
            <figcaption>
              <span>{t('musicCurators.figures.bornFromEmotions')}</span>
              <span>{t('musicCurators.figures.linkedFirst')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
