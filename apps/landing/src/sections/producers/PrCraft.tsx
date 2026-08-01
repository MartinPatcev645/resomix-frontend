import { useTranslation } from 'react-i18next';

export function PrCraft() {
  const { t } = useTranslation('common');

  return (
    <section className="pr-section" id="pr-craft">
      <div className="pr-frame">
        <div className="pr-ctl-grid">
          <div>
            <p className="pr-eyebrow uppercase">{t('producers.craft.eyebrow')}</p>
            <h2 className="pr-h2b uppercase">{t('producers.craft.h2')}</h2>
            <p className="pr-body">{t('producers.craft.body')}</p>
          </div>

          <figure
            className="pr-fig"
            role="img"
            aria-label={t('producers.craft.figureAria')}
          >
            <svg className="pr-sl" viewBox="0 56 560 292" aria-hidden="true">
              <circle
                className="pr-pulse"
                cx="64"
                cy="150"
                r="4.5"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <text x="14" y="196" style={{ fontSize: '12px', fill: '#e2e2e2' }}>
                {t('producers.figures.referenceTrack')}
              </text>
              <path
                d="M72 150 C 110 150 140 150 172 150"
                style={{ color: 'rgba(238,74,38,.7)', strokeWidth: 1.8 }}
              />
              <circle cx="186" cy="150" r="5" style={{ fill: '#EE4A26', stroke: 'none' }} />
              <circle cx="186" cy="150" r="10.5" style={{ color: 'rgba(238,74,38,.35)' }} />
              <text
                x="186"
                y="106"
                textAnchor="middle"
                style={{ fontSize: '12px', fill: '#e2e2e2' }}
              >
                {t('producers.figures.pyxisSonicProfile')}
              </text>
              <text
                x="186"
                y="124"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#ababab' }}
              >
                {t('producers.figures.seventyPlus')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.2)' }}>
                <path d="M194 144 C 240 116 270 100 300 92" />
                <path d="M196 147 C 246 132 276 124 306 120" />
                <path d="M196 153 C 246 168 276 176 306 180" />
                <path d="M194 156 C 240 184 270 200 300 208" />
              </g>
              <g style={{ fill: '#ababab' }}>
                <text x="304" y="88" style={{ fontSize: '11px' }}>
                  {t('producers.figures.grooveRhythm')}
                </text>
                <text x="310" y="122" style={{ fontSize: '11px' }}>
                  {t('producers.figures.harmonyTonality')}
                </text>
                <text x="310" y="188" style={{ fontSize: '11px' }}>
                  {t('producers.figures.timbreTexture')}
                </text>
                <text x="304" y="218" style={{ fontSize: '11px' }}>
                  {t('producers.figures.structureEnergy')}
                </text>
              </g>
              <path
                className="pr-dashflow"
                d="M198 150 C 290 150 380 150 452 150"
                style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.6 }}
              />
              <circle
                cx="466"
                cy="150"
                r="6.5"
                style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
              />
              <circle
                cx="466"
                cy="150"
                r="11.5"
                style={{ color: 'rgba(255,255,255,.85)', strokeWidth: 1.8 }}
              />
              <text
                x="466"
                y="248"
                textAnchor="middle"
                style={{ fontSize: '12px', fill: '#e2e2e2' }}
              >
                {t('producers.figures.relatedDirections')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.8)' }}>
                <path
                  d="M478 146 C 500 132 516 156 534 144 C 542 139 548 138 552 140"
                  style={{ strokeWidth: 1.8 }}
                />
              </g>
              <text x="24" y="330" style={{ fontSize: '11.5px', fill: '#ababab' }}>
                {t('producers.figures.analysisSurfaces')}
              </text>
              <text
                x="546"
                y="330"
                textAnchor="end"
                style={{ fontSize: '11.5px', fill: '#e2e2e2' }}
              >
                {t('producers.figures.producerMakes')}
              </text>
            </svg>
          </figure>
        </div>
      </div>
    </section>
  );
}
