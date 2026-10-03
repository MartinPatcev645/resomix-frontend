import { useTranslation, Trans } from 'react-i18next';
import { BLOG } from '@/routes/blogLinks.ts';

export function MlTags() {
  const { t } = useTranslation('common');

  return (
    <section className="ml-section" id="ml-tags">
      <div className="ml-frame">
        <div className="ml-tag-grid">
          <div>
            <p className="ml-eyebrow uppercase">{t('musicLibraries.tags.eyebrow')}</p>
            <h2 className="ml-h2b uppercase">{t('musicLibraries.tags.h2')}</h2>
            <p className="ml-body"><Trans i18nKey="musicLibraries.tags.p1" components={{ a: <a href={BLOG.beyondTags} /> }} /></p>
            <p className="ml-body">{t('musicLibraries.tags.p2')}</p>
            <p className="ml-body ml-body-soft">{t('musicLibraries.tags.p3')}</p>
          </div>

          <figure
            className="ml-fig"
            role="img"
            aria-label={t('musicLibraries.tags.figureAria')}
          >
            {/* Illustrative — same tag, different waveforms; search you can't type. */}
            <svg className="ml-sl" viewBox="0 0 560 400" aria-hidden="true">
              <g style={{ color: 'rgba(255,255,255,.35)' }}>
                <rect x="222" y="28" width="116" height="26" />
              </g>
              <text
                x="280"
                y="45"
                textAnchor="middle"
                style={{ fontSize: '10.5px', fill: '#c9c9c9' }}
              >
                {t('musicLibraries.figures.electronic')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.18)' }}>
                <path d="M254 54 C 210 70 180 84 160 96" />
                <path d="M306 54 C 350 70 380 84 400 96" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.28)' }}>
                <rect x="60" y="96" width="200" height="92" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.6)' }}>
                <path
                  d="M76 160 l6-34 5 34 8-20 6 20 9-38 5 38 8-16 6 16 8-30 6 30 8-12 6 12 9-26 5 26 8-18 6 18 8-34 5 34"
                  style={{ strokeWidth: 1.3 }}
                />
              </g>
              <text x="160" y="206" textAnchor="middle" style={{ fontSize: '10px' }}>
                {t('musicLibraries.figures.patternOne')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.28)' }}>
                <rect x="300" y="96" width="200" height="92" />
              </g>
              <g style={{ color: 'rgba(255,255,255,.6)' }}>
                <path
                  d="M316 152 C 340 120 366 118 388 140 C 410 162 434 166 456 142 C 470 128 480 126 484 130"
                  style={{ strokeWidth: 1.3 }}
                />
              </g>
              <text x="400" y="206" textAnchor="middle" style={{ fontSize: '10px' }}>
                {t('musicLibraries.figures.patternTwo')}
              </text>
              <line
                x1="60"
                y1="240"
                x2="500"
                y2="240"
                strokeDasharray="2 6"
                style={{ color: 'rgba(255,255,255,.14)' }}
              />
              <g style={{ color: 'rgba(255,255,255,.5)' }}>
                <path
                  d="M76 300 l8-9 6 14 8-19 8 22 7-15 6 8 7-4 7 5"
                  style={{ strokeWidth: 1.4 }}
                />
              </g>
              <circle
                className="ml-pulse"
                cx="134"
                cy="300"
                r="3"
                style={{ fill: '#EE4A26', stroke: 'none' }}
              />
              <text x="76" y="336" style={{ fontSize: '10px', fill: '#d8d8d8' }}>
                {t('musicLibraries.figures.soundInYourHead')}
              </text>
              <g style={{ color: 'rgba(255,255,255,.3)' }}>
                <rect x="300" y="284" width="200" height="34" />
              </g>
              <line
                x1="316"
                y1="301"
                x2="322"
                y2="301"
                style={{ color: 'rgba(238,74,38,.8)', strokeWidth: 1.6 }}
              />
              <text x="300" y="342" style={{ fontSize: '10px' }}>
                {t('musicLibraries.figures.nothingToType')}
              </text>
            </svg>
            <figcaption>
              <span>{t('musicLibraries.figures.sameTagDifferent')}</span>
              <span>{t('musicLibraries.figures.hearCantType')}</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
