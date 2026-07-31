import { useTranslation } from 'react-i18next';

export function MlLost() {
  const { t } = useTranslation('common');

  return (
    <section className="ml-section" id="ml-lost">
      <div className="ml-frame">
        <div className="ml-lost-grid">
          <div>
            <p className="ml-eyebrow uppercase">{t('musicLibraries.lost.eyebrow')}</p>
            <h2 className="ml-h2b uppercase">{t('musicLibraries.lost.h2')}</h2>
            <p className="ml-body">{t('musicLibraries.lost.p1')}</p>
            <p className="ml-body">{t('musicLibraries.lost.p2')}</p>
            <p className="ml-body ml-body-soft">{t('musicLibraries.lost.p3')}</p>
          </div>

          <figure
            className="ml-fig"
            role="img"
            aria-label={t('musicLibraries.lost.figureAria')}
          >
            {/* Illustrative — stacked crates fading with depth; buried tile lifted to Found. */}
            <svg className="ml-sl" viewBox="0 0 560 380" aria-hidden="true">
              <text x="36" y="38" style={{ fontSize: '11px' }}>
                {t('musicLibraries.figures.theCrate')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.4)' }}>
                <rect x="60" y="56" width="440" height="34" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.32)' }}>
                <rect x="60" y="98" width="440" height="34" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.25)' }}>
                <rect x="60" y="140" width="440" height="34" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.18)' }}>
                <rect x="60" y="182" width="440" height="34" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.12)' }}>
                <rect x="60" y="224" width="440" height="34" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.08)' }}>
                <rect x="60" y="266" width="440" height="34" />
              </g>
              <rect
                x="332"
                y="224"
                width="72"
                height="34"
                style={{ color: 'rgba(238,74,38,.85)', strokeWidth: 1.6 }}
              />
              <g style={{ color: 'rgba(255,255,255,.7)' }}>
                <path
                  d="M344 241 l5-5 4 8 5-11 5 12 4-8 4 4 3-2"
                  style={{ strokeWidth: 1.2 }}
                />
              </g>
              <circle
                className="ml-glowp"
                cx="368"
                cy="241"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <text x="416" y="246" style={{ fontSize: '10.5px', fill: '#EE4A26' }}>
                {t('musicLibraries.figures.buried')}
              </text>
              <path
                className="ml-dashflow"
                d="M368 224 C 368 160 420 100 468 64"
                style={{ color: 'rgba(238,74,38,.6)', strokeWidth: 1.6 }}
              />
              <circle
                cx="474"
                cy="56"
                r="12"
                style={{ color: 'rgba(255,255,255,.85)', strokeWidth: 1.8 }}
              />
              <text
                x="474"
                y="30"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#d8d8d8' }}
              >
                {t('musicLibraries.figures.found')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.14)' }}>
                <line x1="40" y1="73" x2="48" y2="73" />
                <line x1="40" y1="115" x2="48" y2="115" />
                <line x1="40" y1="157" x2="48" y2="157" />
                <line x1="40" y1="199" x2="48" y2="199" />
                <line x1="40" y1="241" x2="48" y2="241" />
                <line x1="40" y1="283" x2="48" y2="283" />
              </g>
              <text x="60" y="336" style={{ fontSize: '10px' }}>
                {t('musicLibraries.figures.yearsOfBuilding')}
              </text>
              <text x="386" y="336" style={{ fontSize: '10px', fill: '#d8d8d8' }}>
                {t('musicLibraries.figures.surfacedBySound')}
              </text>
            </svg>
            <figcaption>
              <span>{t('musicLibraries.figures.buriedInThePile')}</span>
              <span>{t('musicLibraries.figures.surfacedBySound')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
