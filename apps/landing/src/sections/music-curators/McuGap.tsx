import { useTranslation } from 'react-i18next';

export function McuGap() {
  const { t } = useTranslation('common');

  return (
    <section className="mcu-section" id="mcu-gap">
      <div className="mcu-frame">
        <div className="mcu-gap-grid">
          <div>
            <p className="mcu-eyebrow uppercase">{t('musicCurators.gap.eyebrow')}</p>
            <h2 className="mcu-h2b uppercase">{t('musicCurators.gap.h2')}</h2>
            <p className="mcu-body">{t('musicCurators.gap.p1')}</p>
            <p className="mcu-body">{t('musicCurators.gap.p2')}</p>
            <p className="mcu-body mcu-body-soft">{t('musicCurators.gap.p3')}</p>
          </div>

          <figure
            className="mcu-fig"
            role="img"
            aria-label={t('musicCurators.gap.figureAria')}
          >
            <svg className="mcu-sl" viewBox="0 0 560 420" aria-hidden="true">
              <line
                x1="40"
                y1="70"
                x2="520"
                y2="70"
                style={{ color: 'rgba(255,255,255,.2)' }}
              />
              <text x="40" y="40" style={{ fontSize: '11px' }}>
                {t('musicCurators.figures.whereDiscoveryStarts')}
              </text>
              <text x="40" y="56" style={{ fontSize: '9.5px', fill: '#6a6a6a' }}>
                {t('musicCurators.figures.depthNote')}
              </text>
              <path
                d="M120 70 L104 330 M120 70 L136 330"
                style={{ color: 'rgba(255,255,255,.35)' }}
              />
              <path d="M104 330 L136 330" style={{ color: 'rgba(255,255,255,.25)' }} />
              <text
                x="120"
                y="352"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#c9c9c9' }}
              >
                {t('musicCurators.figures.humanRecs')}
              </text>
              <text x="120" y="368" textAnchor="middle" style={{ fontSize: '9.5px' }}>
                {t('musicCurators.figures.humanRecsSub')}
              </text>
              <path
                d="M230 70 L200 156 M450 70 L480 156 M200 156 L480 156"
                style={{ color: 'rgba(255,255,255,.3)' }}
              />
              <text
                x="340"
                y="120"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#c9c9c9' }}
              >
                {t('musicCurators.figures.platformRecs')}
              </text>
              <text x="340" y="138" textAnchor="middle" style={{ fontSize: '9.5px' }}>
                {t('musicCurators.figures.platformRecsSub')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.14)' }}>
                <rect x="200" y="190" width="280" height="150" strokeDasharray="4 6" />
              </g>
              <text x="216" y="214" style={{ fontSize: '10px' }}>
                {t('musicCurators.figures.depthCuratorNeeds')}
              </text>
              <g>
                <circle cx="260" cy="250" r="2.2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
                <circle cx="330" cy="280" r="2.2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
                <circle cx="420" cy="240" r="2.2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
                <circle cx="380" cy="310" r="2.2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
                <circle cx="250" cy="310" r="2.2" style={{ fill: 'rgba(255,255,255,.22)', stroke: 'none' }} />
              </g>
              <circle
                className="mcu-glowp"
                cx="420"
                cy="240"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <circle
                className="mcu-glowp"
                cx="330"
                cy="280"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <path
                className="mcu-dashflow"
                d="M340 70 C 350 130 380 180 420 236"
                style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 2 }}
              />
              <path
                d="M340 70 C 335 140 330 210 330 276"
                strokeDasharray="3 5"
                style={{ color: 'rgba(238,74,38,.35)' }}
              />
              <circle cx="340" cy="70" r="4" style={{ fill: '#EE4A26', stroke: 'none' }} />
              <text x="356" y="60" style={{ fontSize: '10.5px', fill: '#EE4A26' }}>
                {t('musicCurators.figures.soulEngine')}
              </text>
              <text x="216" y="396" style={{ fontSize: '10px' }}>
                {t('musicCurators.figures.territoryMiss')}
              </text>
            </svg>
            <figcaption>
              <span>{t('musicCurators.figures.twoWays')}</span>
              <span>{t('musicCurators.figures.territoryTheyMiss')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
